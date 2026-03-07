package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/kshiti/exec-admin-service/internal/auth"
	"github.com/kshiti/exec-admin-service/internal/database"
)

type LocalProject struct {
	ID          int    `json:"id"`
	UserID      int    `json:"user_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

type createProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// LocalProjectsHandler handles CRUD for local user projects
type LocalProjectsHandler struct{}

// List handles GET /api/local/projects
func (h *LocalProjectsHandler) List(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r)
	if claims == nil || claims.UserType != "LOCAL" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Only local users have local projects"})
		return
	}

	ctx := context.Background()
	rows, err := database.Pool.Query(ctx,
		"SELECT id, name, description FROM exec_local_projects WHERE user_id = $1 ORDER BY created_at DESC",
		claims.UserID,
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to fetch projects"})
		return
	}
	defer rows.Close()

	projects := []LocalProject{}
	for rows.Next() {
		var p LocalProject
		p.UserID = claims.UserID
		if err := rows.Scan(&p.ID, &p.Name, &p.Description); err != nil {
			continue
		}
		projects = append(projects, p)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"projects": projects})
}

// Create handles POST /api/local/projects
func (h *LocalProjectsHandler) Create(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r)
	if claims == nil || claims.UserType != "LOCAL" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Only local users can create local projects"})
		return
	}

	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Project name is required"})
		return
	}

	ctx := context.Background()
	var id int
	err := database.Pool.QueryRow(ctx,
		"INSERT INTO exec_local_projects (user_id, name, description) VALUES ($1, $2, $3) RETURNING id",
		claims.UserID, req.Name, req.Description,
	).Scan(&id)

	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to create project"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":          id,
		"name":        req.Name,
		"description": req.Description,
	})
}
