package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/kshiti/exec-admin-service/internal/auth"
	"github.com/kshiti/exec-admin-service/internal/database"
	"github.com/kshiti/exec-admin-service/internal/models"
)

// AdminUsersHandler handles admin CRUD for exec_local_users.
type AdminUsersHandler struct{}

type createUserRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
	Plan        string `json:"plan"`
}

type changePasswordRequest struct {
	NewPassword string `json:"new_password"`
}

// ListUsers handles GET /api/admin/users
func (h *AdminUsersHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()

	rows, err := database.Pool.Query(ctx,
		"SELECT id, email, display_name, plan, is_active, created_at, updated_at FROM exec_local_users ORDER BY created_at DESC",
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to fetch users"})
		return
	}
	defer rows.Close()

	users := []models.LocalUser{}
	for rows.Next() {
		var u models.LocalUser
		if err := rows.Scan(&u.ID, &u.Email, &u.DisplayName, &u.Plan, &u.IsActive, &u.CreatedAt, &u.UpdatedAt); err != nil {
			continue
		}
		users = append(users, u)
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"users": users})
}

// CreateUser handles POST /api/admin/users
func (h *AdminUsersHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Email and password are required"})
		return
	}

	if req.Plan == "" {
		req.Plan = "FREE"
	}

	hash, err := auth.HashBcryptPassword(req.Password)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Password hashing failed"})
		return
	}

	ctx := context.Background()
	var id int
	err = database.Pool.QueryRow(ctx,
		"INSERT INTO exec_local_users (email, password_hash, display_name, plan) VALUES ($1, $2, $3, $4) RETURNING id",
		req.Email, hash, req.DisplayName, req.Plan,
	).Scan(&id)

	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "User with this email already exists"})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"id":      id,
		"email":   req.Email,
		"plan":    req.Plan,
		"message": "User created successfully",
	})
}

// ChangePassword handles PUT /api/admin/users/:id/password
func (h *AdminUsersHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
		return
	}

	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.NewPassword == "" || len(req.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Password must be at least 6 characters"})
		return
	}

	hash, err := auth.HashBcryptPassword(req.NewPassword)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Password hashing failed"})
		return
	}

	ctx := context.Background()
	result, err := database.Pool.Exec(ctx,
		"UPDATE exec_local_users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
		hash, id,
	)
	if err != nil || result.RowsAffected() == 0 {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "User not found"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success", "message": "Password updated"})
}
