package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/kshiti/exec-admin-service/internal/database"
)

type ExecutionHandler struct {
	SupabaseURL string
	SupabaseKey string
}

type ExecutionRequest struct {
	Suite       interface{} `json:"suite"`
	Config      interface{} `json:"config"`
	RunID       string      `json:"runId,omitempty"`
	ProjectID   string      `json:"projectId,omitempty"`
	CompanySlug string      `json:"companySlug,omitempty"`
}

func (h *ExecutionHandler) Run(w http.ResponseWriter, r *http.Request) {
	var req ExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.jsonError(w, "Invalid payload format", http.StatusBadRequest)
		return
	}

	if req.RunID == "" {
		req.RunID = fmt.Sprintf("run-%d", time.Now().UnixMilli())
	}

	projectID := req.ProjectID
	if projectID == "" {
		projectID = "default"
	}
	companySlug := req.CompanySlug
	if companySlug == "" {
		companySlug = "default"
	}
	suiteName := extractSuiteName(req.Suite)

	// Create initial logs
	initialLogs := []map[string]string{
		{
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
			"level":     "INFO",
			"message":   "Execution queued. Waiting for worker...",
		},
	}
	logsJSON, _ := json.Marshal(initialLogs)

	// Embed the config into the suite for the worker to pick up easily
	fullPayload := map[string]interface{}{
		"suite":     req.Suite,
		"config":    req.Config,
		"projectId": projectID,
		"runId":     req.RunID,
	}
	fullPayloadJSON, _ := json.Marshal(fullPayload)

	// Insert "PENDING" record into DB queue
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err := database.Pool.Exec(ctx, `
		INSERT INTO exec_runs 
		(run_id, project_id, company_slug, suite_name, status, start_time, duration_ms, tests_passed, tests_failed, test_cases, logs, triggered_by, payload)
		VALUES ($1, $2, $3, $4, 'PENDING', $5, 0, 0, 0, '[]', $6, 'User', $7)
	`, req.RunID, projectID, companySlug, suiteName, time.Now().UTC(), logsJSON, fullPayloadJSON)

	if err != nil {
		h.jsonError(w, "Failed to queue execution: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return immediately with runId and PENDING status
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"runId":  req.RunID,
		"status": "PENDING",
	})
}

func (h *ExecutionHandler) storeFailedRun(projectID, runID, suiteName, errorMsg string) {
	failResult := map[string]interface{}{
		"runId":       runID,
		"suiteName":   suiteName,
		"status":      "FAILED",
		"startTime":   time.Now().UTC().Format(time.RFC3339Nano),
		"endTime":     time.Now().UTC().Format(time.RFC3339Nano),
		"durationMs":  0,
		"testsPassed": 0,
		"testsFailed": 0,
		"testCases":   []interface{}{},
		"logs": []map[string]string{
			{
				"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
				"level":     "ERROR",
				"message":   errorMsg,
			},
		},
		"projectId":   projectID,
		"triggeredBy": "User",
	}
	failBytes, _ := json.Marshal(failResult)
	SaveRun(projectID, runID, failBytes)
}

func extractSuiteName(suite interface{}) string {
	if m, ok := suite.(map[string]interface{}); ok {
		if name, ok := m["name"].(string); ok {
			return name
		}
	}
	return "Unnamed Suite"
}

func (h *ExecutionHandler) jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
