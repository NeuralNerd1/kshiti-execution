package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/kshiti/exec-admin-service/internal/database"
	"github.com/kshiti/exec-admin-service/internal/models"
)

// AdminPlansHandler handles admin CRUD for exec_plans.
type AdminPlansHandler struct{}

type updatePlanRequest struct {
	DisplayName string         `json:"display_name"`
	PerksJSON   map[string]any `json:"perks_json"`
	IsVisible   *bool          `json:"is_visible"`
}

// ListPlans handles GET /api/admin/plans
func (h *AdminPlansHandler) ListPlans(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	rows, err := database.Pool.Query(ctx,
		"SELECT id, plan_key, display_name, perks_json, is_visible, created_at FROM exec_plans ORDER BY id",
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to fetch plans"})
		return
	}
	defer rows.Close()

	plans := []models.Plan{}
	for rows.Next() {
		var p models.Plan
		if err := rows.Scan(&p.ID, &p.PlanKey, &p.DisplayName, &p.PerksJSON, &p.IsVisible, &p.CreatedAt); err != nil {
			continue
		}
		plans = append(plans, p)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"plans": plans})
}

// UpdatePlan handles PUT /api/admin/plans/:id
func (h *AdminPlansHandler) UpdatePlan(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid plan ID"})
		return
	}

	var req updatePlanRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	ctx := context.Background()

	// Build dynamic update
	perksBytes, _ := json.Marshal(req.PerksJSON)

	if req.IsVisible != nil {
		_, err = database.Pool.Exec(ctx,
			"UPDATE exec_plans SET display_name = COALESCE(NULLIF($1, ''), display_name), perks_json = $2, is_visible = $3 WHERE id = $4",
			req.DisplayName, perksBytes, *req.IsVisible, id,
		)
	} else {
		_, err = database.Pool.Exec(ctx,
			"UPDATE exec_plans SET display_name = COALESCE(NULLIF($1, ''), display_name), perks_json = $2 WHERE id = $3",
			req.DisplayName, perksBytes, id,
		)
	}

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to update plan"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success", "message": "Plan updated"})
}
