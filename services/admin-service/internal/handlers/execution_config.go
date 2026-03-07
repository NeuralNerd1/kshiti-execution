package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/kshiti/exec-admin-service/internal/database"
)

type ExecutionConfigHandler struct{}

func (h *ExecutionConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	if projectID == "" {
		h.jsonError(w, "Project ID is required", http.StatusBadRequest)
		return
	}

	var configJSON []byte
	
	err := database.Pool.QueryRow(context.Background(), `
		SELECT config FROM exec_configs WHERE project_id = $1
	`, projectID).Scan(&configJSON)

	if err != nil {
		// If no config exists, return empty JSON object instead of 404
		// allows front-end to safely merge with DEFAULT_CONFIG
		if err.Error() == "no rows in result set" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("{}"))
			return
		}

		h.jsonError(w, "Failed to fetch configuration: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(configJSON)
}

func (h *ExecutionConfigHandler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	if projectID == "" {
		h.jsonError(w, "Project ID is required", http.StatusBadRequest)
		return
	}

	var payload map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		h.jsonError(w, "Invalid payload format", http.StatusBadRequest)
		return
	}

	configBytes, _ := json.Marshal(payload)

	_, err := database.Pool.Exec(context.Background(), `
		INSERT INTO exec_configs (project_id, config, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (project_id)
		DO UPDATE SET config = $2, updated_at = NOW()
	`, projectID, configBytes)

	if err != nil {
		h.jsonError(w, "Failed to persist configuration: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success","message":"Configuration saved successfully"}`))
}

func (h *ExecutionConfigHandler) jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
