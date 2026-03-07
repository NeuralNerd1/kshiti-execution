package handlers

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// SupabaseLogUploader handles uploading log files to Supabase Storage
type SupabaseLogUploader struct {
	SupabaseURL string
	SupabaseKey string
	Bucket      string
}

// UploadLogs splits execution logs by level and uploads them to Supabase Storage
// path: {company}/{projectId}/{datetime}/{runId}/{suiteName}/
func (u *SupabaseLogUploader) UploadLogs(companySlug, projectID, runID, suiteName string, logs []map[string]interface{}) {
	if u.SupabaseURL == "" || u.SupabaseKey == "" {
		log.Println("⚠ Supabase not configured, skipping log upload")
		return
	}

	// Build datetime string from first log or now
	dateTime := time.Now().UTC().Format("2006-01-02_15-04-05")

	// Clean suite name for path safety
	safeSuiteName := strings.ReplaceAll(suiteName, "/", "_")
	safeSuiteName = strings.ReplaceAll(safeSuiteName, " ", "_")

	basePath := fmt.Sprintf("%s/%s/%s/%s/%s",
		companySlug, projectID, dateTime, runID, safeSuiteName)

	// Split logs by level
	logsByLevel := map[string][]string{
		"all":     {},
		"info":    {},
		"debug":   {},
		"error":   {},
		"network": {},
		"warn":    {},
	}

	for _, logEntry := range logs {
		ts, _ := logEntry["timestamp"].(string)
		level, _ := logEntry["level"].(string)
		msg, _ := logEntry["message"].(string)

		line := fmt.Sprintf("[%s] [%s] %s", ts, level, msg)
		logsByLevel["all"] = append(logsByLevel["all"], line)

		levelKey := strings.ToLower(level)
		if _, ok := logsByLevel[levelKey]; ok {
			logsByLevel[levelKey] = append(logsByLevel[levelKey], line)
		}
	}

	// Upload each log file
	for level, lines := range logsByLevel {
		if len(lines) == 0 {
			continue
		}
		content := strings.Join(lines, "\n")
		filePath := fmt.Sprintf("%s/%s.log", basePath, level)
		u.uploadFile(filePath, []byte(content))
	}

	log.Printf("✓ Uploaded %d log files to Supabase Storage: %s", len(logsByLevel), basePath)
}

func (u *SupabaseLogUploader) uploadFile(path string, content []byte) {
	url := fmt.Sprintf("%s/storage/v1/object/%s/%s", u.SupabaseURL, u.Bucket, path)

	req, err := http.NewRequest("POST", url, bytes.NewReader(content))
	if err != nil {
		log.Printf("Failed to create upload request: %v", err)
		return
	}

	req.Header.Set("Authorization", "Bearer "+u.SupabaseKey)
	req.Header.Set("apikey", u.SupabaseKey)
	req.Header.Set("Content-Type", "text/plain")
	req.Header.Set("x-upsert", "true") // Overwrite if exists

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("Failed to upload log file %s: %v", path, err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("Supabase upload error for %s: %d %s", path, resp.StatusCode, string(body))
	} else {
		log.Printf("✓ Uploaded log file: %s", path)
	}
}
