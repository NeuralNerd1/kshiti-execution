package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"

	"github.com/kshiti/exec-admin-service/internal/database"
)

type ExecutionRunsHandler struct{}

// getProjectRunsDir returns the directory for a project's runs, creating it if needed
// This is deprecated but kept for backwards compatibility stub if needed by other components.
// We strictly use DB now.
func getProjectRunsDir(projectID string) string {
	return ""
}

// SaveRun persists an execution run result to disk
// This is deprecated but kept for backwards compatibility stub if needed by other components.
func SaveRun(projectID, runID string, result json.RawMessage) error {
	return nil
}

// GetRun retrieves a single run by ID (GET /api/execution/run/{runId})
func (h *ExecutionRunsHandler) GetRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")
	if runID == "" {
		h.jsonError(w, "Run ID is required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var projectID, companySlug, suiteName, status string
	var startTime time.Time
	var endTime *time.Time
	var durationMs int64
	var testsPassed, testsFailed int
	var testCases, logs []byte
	var triggeredBy string

	err := database.Pool.QueryRow(ctx, `
		SELECT project_id, company_slug, suite_name, status, start_time, end_time, duration_ms, tests_passed, tests_failed, test_cases, logs, triggered_by
		FROM exec_runs
		WHERE run_id = $1
	`, runID).Scan(&projectID, &companySlug, &suiteName, &status, &startTime, &endTime, &durationMs, &testsPassed, &testsFailed, &testCases, &logs, &triggeredBy)

	if err != nil {
		if err == pgx.ErrNoRows {
			h.jsonError(w, "Run not found", http.StatusNotFound)
			return
		}
		h.jsonError(w, "Database error mapping run", http.StatusInternalServerError)
		return
	}

	// Reconstruct the JSON structure exactly as the frontend expects it.
	// Since testCases and logs are stored as JSONB, we serialize them back as raw JSON arrays.
	var endTimeStr *string
	if endTime != nil {
		str := endTime.Format(time.RFC3339Nano)
		endTimeStr = &str
	}

	response := map[string]interface{}{
		"runId":       runID,
		"projectId":   projectID,
		"companySlug": companySlug,
		"suiteName":   suiteName,
		"status":      status,
		"startTime":   startTime.Format(time.RFC3339Nano),
		"endTime":     endTimeStr,
		"durationMs":  durationMs,
		"testsPassed": testsPassed,
		"testsFailed": testsFailed,
		"testCases":   json.RawMessage(testCases),
		"logs":        json.RawMessage(logs),
		"triggeredBy": triggeredBy,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// ListRuns returns all runs for a project (GET /api/execution/runs/{projectId})
func (h *ExecutionRunsHandler) ListRuns(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	if projectID == "" {
		h.jsonError(w, "Project ID is required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	rows, err := database.Pool.Query(ctx, `
		SELECT run_id, project_id, company_slug, suite_name, status, start_time, end_time, duration_ms, tests_passed, tests_failed, test_cases, logs, triggered_by
		FROM exec_runs
		WHERE project_id = $1
		ORDER BY start_time DESC
		LIMIT 50
	`, projectID)

	if err != nil {
		h.jsonError(w, "Database error listing runs", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var runs []map[string]interface{}

	for rows.Next() {
		var runID, pID, companySlug, suiteName, status string
		var startTime time.Time
		var endTime *time.Time
		var durationMs int64
		var testsPassed, testsFailed int
		var testCases, logs []byte
		var triggeredBy string

		if err := rows.Scan(&runID, &pID, &companySlug, &suiteName, &status, &startTime, &endTime, &durationMs, &testsPassed, &testsFailed, &testCases, &logs, &triggeredBy); err != nil {
			continue
		}

		var endTimeStr *string
		if endTime != nil {
			str := endTime.Format(time.RFC3339Nano)
			endTimeStr = &str
		}

		run := map[string]interface{}{
			"runId":       runID,
			"projectId":   pID,
			"companySlug": companySlug,
			"suiteName":   suiteName,
			"status":      status,
			"startTime":   startTime.Format(time.RFC3339Nano),
			"endTime":     endTimeStr,
			"durationMs":  durationMs,
			"testsPassed": testsPassed,
			"testsFailed": testsFailed,
			"testCases":   json.RawMessage(testCases),
			"logs":        json.RawMessage(logs),
			"triggeredBy": triggeredBy,
		}
		runs = append(runs, run)
	}

	if runs == nil {
		runs = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(runs)
}

// StopRun stops a running or pending execution (POST /api/execution/run/{runId}/stop)
func (h *ExecutionRunsHandler) StopRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runId")
	if runID == "" {
		h.jsonError(w, "Run ID is required", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	tag, err := database.Pool.Exec(ctx, `
		UPDATE exec_runs
		SET status = 'STOPPED', end_time = NOW()
		WHERE run_id = $1 AND status IN ('PENDING', 'RUNNING')
	`, runID)

	if err != nil {
		h.jsonError(w, "Failed to stop execution: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if tag.RowsAffected() == 0 {
		h.jsonError(w, "Run not found or already completed", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "STOPPED", "runId": runID})
}

func (h *ExecutionRunsHandler) jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
