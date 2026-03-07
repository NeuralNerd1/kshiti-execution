package handlers

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/kshiti/exec-admin-service/internal/auth"
	"github.com/kshiti/exec-admin-service/internal/database"
	"github.com/kshiti/exec-admin-service/internal/models"
)

// AuthHandler handles authentication endpoints.
type AuthHandler struct {
	JWTSecret    string
	BridgeClient *auth.BridgeClient
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token string          `json:"token"`
	User  models.AuthUser `json:"user"`
}

// Login handles POST /api/auth/login
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request body"})
		return
	}

	if req.Email == "" || req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Email and password are required"})
		return
	}

	ctx := context.Background()

	// 1. Check exec_local_users first
	var localUser models.LocalUser
	err := database.Pool.QueryRow(ctx,
		"SELECT id, email, password_hash, display_name, plan, is_active FROM exec_local_users WHERE email = $1",
		req.Email,
	).Scan(&localUser.ID, &localUser.Email, &localUser.PasswordHash, &localUser.DisplayName, &localUser.Plan, &localUser.IsActive)

	if err == nil {
		// Found in exec_local_users
		if !localUser.IsActive {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "Account is deactivated"})
			return
		}
		if !auth.VerifyBcryptPassword(req.Password, localUser.PasswordHash) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
			return
		}

		token, err := auth.GenerateToken(h.JWTSecret, localUser.ID, localUser.Email, "LOCAL", localUser.Plan)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Token generation failed"})
			return
		}

		writeJSON(w, http.StatusOK, loginResponse{
			Token: token,
			User: models.AuthUser{
				ID:          localUser.ID,
				Email:       localUser.Email,
				DisplayName: localUser.DisplayName,
				Plan:        localUser.Plan,
				UserType:    "LOCAL",
			},
		})
		return
	}

	// 2. Check auth_user (company users from planning app — read-only)
	var companyUser models.CompanyUser
	err = database.Pool.QueryRow(ctx,
		"SELECT id, email, password, first_name, last_name, is_active, COALESCE(exec_plan, 'COMPANY') FROM auth_user WHERE email = $1",
		req.Email,
	).Scan(&companyUser.ID, &companyUser.Email, &companyUser.Password, &companyUser.FirstName, &companyUser.LastName, &companyUser.IsActive, &companyUser.ExecPlan)

	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
		return
	}

	if !companyUser.IsActive {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "Account is deactivated"})
		return
	}

	if !auth.VerifyDjangoPassword(req.Password, companyUser.Password) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
		return
	}

	displayName := companyUser.FirstName
	if companyUser.LastName != "" {
		displayName += " " + companyUser.LastName
	}
	if displayName == "" {
		displayName = companyUser.Email
	}

	token, err := auth.GenerateToken(h.JWTSecret, companyUser.ID, companyUser.Email, "COMPANY", companyUser.ExecPlan)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Token generation failed"})
		return
	}

	writeJSON(w, http.StatusOK, loginResponse{
		Token: token,
		User: models.AuthUser{
			ID:          companyUser.ID,
			Email:       companyUser.Email,
			DisplayName: displayName,
			Plan:        companyUser.ExecPlan,
			UserType:    "COMPANY",
		},
	})
}

// Session handles GET /api/auth/session
func (h *AuthHandler) Session(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r)
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Not authenticated"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"authenticated": true,
		"user": models.AuthUser{
			ID:       claims.UserID,
			Email:    claims.Email,
			Plan:     claims.Plan,
			UserType: claims.UserType,
		},
	})
}

// BridgeLogin handles POST /api/auth/bridge-login
// Exchanges a valid Django Bridge token for a local Execution token
func (h *AuthHandler) BridgeLogin(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Authorization header required"})
		return
	}

	tokenString := authHeader
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenString = authHeader[7:]
	}

	// 1. Verify with Bridge
	result, err := h.BridgeClient.VerifyJWT(tokenString)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Bridge verification failed: " + err.Error()})
		return
	}

	// 2. We now know user's email from bridge result. Fetch their plan from database.
	ctx := context.Background()
	var companyUser models.CompanyUser
	err = database.Pool.QueryRow(ctx,
		"SELECT id, email, first_name, last_name, COALESCE(exec_plan, 'COMPANY') FROM auth_user WHERE email = $1",
		result.User.Email,
	).Scan(&companyUser.ID, &companyUser.Email, &companyUser.FirstName, &companyUser.LastName, &companyUser.ExecPlan)

	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "User synced from bridge not found locally"})
		return
	}

	displayName := companyUser.FirstName
	if companyUser.LastName != "" {
		displayName += " " + companyUser.LastName
	}
	if displayName == "" {
		displayName = companyUser.Email
	}

	// 3. Generate Execution Go Token
	execToken, err := auth.GenerateToken(h.JWTSecret, companyUser.ID, companyUser.Email, "COMPANY", companyUser.ExecPlan)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Token generation failed"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"token": execToken,
		"user": models.AuthUser{
			ID:          companyUser.ID,
			Email:       companyUser.Email,
			DisplayName: displayName,
			Plan:        companyUser.ExecPlan,
			UserType:    "COMPANY",
		},
		"bridge_data": result, // Return the bridge data (company/projects) for UI routing
	})
}

// ProjectSnapshot handles GET /api/bridge/project-snapshot/{id}
func (h *AuthHandler) ProjectSnapshot(w http.ResponseWriter, r *http.Request) {
	claims := auth.GetClaims(r)
	if claims == nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Not authenticated"})
		return
	}

	projectID := chi.URLParam(r, "id")
	if projectID == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Project ID required"})
		return
	}

	snapshot, err := h.BridgeClient.GetProjectSnapshot(projectID, claims.UserID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to fetch project snapshot: " + err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, snapshot)
}

// Helper to write JSON response
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}
