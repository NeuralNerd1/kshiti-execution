package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/jackc/pgx/v4/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	log.Println("Starting Execution Worker...")
	
	// Load .env from current directory (non-fatal; on Render env vars are injected directly)
	if err := godotenv.Load(); err != nil {
		log.Printf("No .env file found, reading from environment variables directly")
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("Unable to connect to database: %v", err)
	}
	defer pool.Close()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	log.Println("Worker is ready and polling for PENDING runs...")

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-sigChan:
			log.Println("Shutting down worker gracefully...")
			return
		case <-ticker.C:
			pollAndExecute(ctx, pool, dbURL)
		}
	}
}

func pollAndExecute(ctx context.Context, pool *pgxpool.Pool, dbURL string) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Printf("Failed to begin transaction: %v", err)
		return
	}
	defer tx.Rollback(ctx)

	var runID string
	var projectID string
	var testCasesJSON []byte

	// SKIP LOCKED prevents concurrent workers from picking up the same job
	query := `
		SELECT run_id, project_id, payload
		FROM exec_runs
		WHERE status = 'PENDING'
		ORDER BY start_time ASC
		FOR UPDATE SKIP LOCKED
		LIMIT 1
	`
	err = tx.QueryRow(ctx, query).Scan(&runID, &projectID, &testCasesJSON)
	if err != nil {
		// pgx.ErrNoRows implies no pending jobs
		if !strings.Contains(err.Error(), "no rows") {
			log.Printf("DB query error: %v", err)
		}
		return
	}

	// Mark as RUNNING
	_, err = tx.Exec(ctx, "UPDATE exec_runs SET status = 'RUNNING' WHERE run_id = $1", runID)
	if err != nil {
		log.Printf("Failed to update status to RUNNING for %s: %v", runID, err)
		return
	}

	// Commit transaction to release lock so other workers can grab the next job
	if err := tx.Commit(ctx); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		return
	}

	log.Printf("==============================================")
	log.Printf("🚀 Acquired Job: %s (Project: %s)", runID, projectID)
	log.Printf("==============================================")

	// Build the JSON payload for the Playwright engine
	var fullPayload map[string]interface{}
	if err := json.Unmarshal(testCasesJSON, &fullPayload); err != nil {
		log.Printf("Failed to parse test cases for %s: %v", runID, err)
		markFailed(ctx, pool, runID, "Failed to parse test cases JSON")
		return
	}

	fullPayload["runId"] = runID
	fullPayload["projectId"] = projectID

	tempDir := os.TempDir()
	payloadPath := filepath.Join(tempDir, fmt.Sprintf("payload_%s.json", runID))
	payloadBytes, _ := json.Marshal(fullPayload)

	if err := os.WriteFile(payloadPath, payloadBytes, 0644); err != nil {
		log.Printf("Failed to write payload file: %v", err)
		markFailed(ctx, pool, runID, "Failed to write payload file")
		return
	}
	defer os.Remove(payloadPath)

	cwd, _ := os.Getwd()
	enginePath := filepath.Join(cwd, "..", "playwright-engine", "execute.js")
	if _, err := os.Stat(enginePath); os.IsNotExist(err) {
		enginePath = filepath.Join(cwd, "..", "..", "playwright-engine", "execute.js")
	}

	log.Printf("Spawning Playwright Engine for run %s...", runID)

	cmd := exec.Command("node", enginePath, payloadPath)
	// Pass the same DB URL so the JS script can push live updates
	cmd.Env = append(os.Environ(), "DATABASE_URL="+dbURL)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err = cmd.Start()
	if err != nil {
		log.Printf("❌ Failed to start Playwright Engine for %s: %v", runID, err)
		markFailed(ctx, pool, runID, "Engine failed to start")
		return
	}

	// Background goroutine: poll DB for STOPPED status and kill the process
	stopChan := make(chan struct{})
	go func() {
		checkTicker := time.NewTicker(2 * time.Second)
		defer checkTicker.Stop()
		for {
			select {
			case <-stopChan:
				return
			case <-checkTicker.C:
				var status string
				err := pool.QueryRow(ctx, "SELECT status FROM exec_runs WHERE run_id = $1", runID).Scan(&status)
				if err == nil && status == "STOPPED" {
					log.Printf("🛑 Stop signal detected for run %s — killing engine process", runID)
					if cmd.Process != nil {
						cmd.Process.Kill()
					}
					return
				}
			}
		}
	}()

	waitErr := cmd.Wait()
	close(stopChan)

	// Check if the run was stopped (don't re-mark as FAILED)
	var finalStatus string
	_ = pool.QueryRow(ctx, "SELECT status FROM exec_runs WHERE run_id = $1", runID).Scan(&finalStatus)

	if finalStatus == "STOPPED" {
		log.Printf("⏹ Run %s was stopped by user", runID)
	} else if waitErr != nil {
		log.Printf("❌ Playwright Engine failed for %s: %v", runID, waitErr)
		markFailed(ctx, pool, runID, "Engine crashed or threw an unhandled error")
	} else {
		log.Printf("✅ Playwright Engine finished for %s", runID)
	}

	// Upload logs to Supabase Storage after execution completes
	uploadLogsToSupabase(ctx, pool, runID, projectID)
}

func markFailed(ctx context.Context, pool *pgxpool.Pool, runID, errorMsg string) {
	_, err := pool.Exec(ctx, `
		UPDATE exec_runs 
		SET status = 'FAILED', end_time = NOW()
		WHERE run_id = $1
	`, runID)
	if err != nil {
		log.Printf("Failed to mark run %s as FAILED: %v", runID, err)
	}
}

// uploadLogsToSupabase reads the run's logs from DB and uploads them to Supabase Storage
// Path structure: {company}/{projectId}/{datetime}/{runId}/{suiteName}/{level}.log
func uploadLogsToSupabase(ctx context.Context, pool *pgxpool.Pool, runID, projectID string) {
	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_KEY")
	if supabaseURL == "" || supabaseKey == "" {
		log.Println("⚠ Supabase not configured (SUPABASE_URL/SUPABASE_KEY missing), skipping log upload")
		return
	}

	// Read run metadata and logs from DB
	var companySlug, suiteName string
	var logsJSON []byte
	err := pool.QueryRow(ctx,
		"SELECT company_slug, suite_name, logs FROM exec_runs WHERE run_id = $1", runID,
	).Scan(&companySlug, &suiteName, &logsJSON)
	if err != nil {
		log.Printf("⚠ Failed to read run data for log upload: %v", err)
		return
	}

	var logs []map[string]interface{}
	if err := json.Unmarshal(logsJSON, &logs); err != nil {
		log.Printf("⚠ Failed to parse logs JSON for upload: %v", err)
		return
	}

	if len(logs) == 0 {
		log.Println("⚠ No logs to upload")
		return
	}

	// Build path
	dateTime := time.Now().UTC().Format("2006-01-02_15-04-05")
	safeSuiteName := strings.ReplaceAll(strings.ReplaceAll(suiteName, "/", "_"), " ", "_")
	if companySlug == "" {
		companySlug = "default"
	}
	basePath := fmt.Sprintf("%s/%s/%s/%s/%s", companySlug, projectID, dateTime, runID, safeSuiteName)

	// Split logs by level
	logsByLevel := map[string][]string{
		"all": {}, "info": {}, "debug": {}, "error": {}, "network": {}, "warn": {},
	}

	for _, entry := range logs {
		ts, _ := entry["timestamp"].(string)
		level, _ := entry["level"].(string)
		msg, _ := entry["message"].(string)
		line := fmt.Sprintf("[%s] [%s] %s", ts, level, msg)

		logsByLevel["all"] = append(logsByLevel["all"], line)
		levelKey := strings.ToLower(level)
		if _, ok := logsByLevel[levelKey]; ok {
			logsByLevel[levelKey] = append(logsByLevel[levelKey], line)
		}
	}

	bucket := "execution-logs"
	uploaded := 0
	for level, lines := range logsByLevel {
		if len(lines) == 0 {
			continue
		}
		content := strings.Join(lines, "\n")
		filePath := fmt.Sprintf("%s/%s.log", basePath, level)

		uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, filePath)
		req, err := http.NewRequest("POST", uploadURL, bytes.NewReader([]byte(content)))
		if err != nil {
			log.Printf("⚠ Failed to create upload request for %s: %v", filePath, err)
			continue
		}
		req.Header.Set("Authorization", "Bearer "+supabaseKey)
		req.Header.Set("apikey", supabaseKey)
		req.Header.Set("Content-Type", "text/plain")
		req.Header.Set("x-upsert", "true")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			log.Printf("⚠ Failed to upload %s: %v", filePath, err)
			continue
		}
		if resp.StatusCode >= 300 {
			body, _ := io.ReadAll(resp.Body)
			log.Printf("⚠ Supabase upload error for %s: %d %s", filePath, resp.StatusCode, string(body))
		} else {
			uploaded++
		}
		resp.Body.Close()
	}

	log.Printf("📤 Uploaded %d log files to Supabase Storage: %s", uploaded, basePath)
}
