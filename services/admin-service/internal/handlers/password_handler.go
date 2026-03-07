package handlers

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"time"

	"github.com/kshiti/exec-admin-service/internal/auth"
	"github.com/kshiti/exec-admin-service/internal/database"
	"github.com/kshiti/exec-admin-service/internal/email"
)

// PasswordHandler handles forgot/reset password endpoints.
type PasswordHandler struct {
	JWTSecret string
	Mailer    *email.Sender
}

type forgotRequest struct {
	Email string `json:"email"`
}

type verifyCodeRequest struct {
	Email string `json:"email"`
	Code  string `json:"code"`
}

type resetPasswordRequest struct {
	ResetToken  string `json:"reset_token"`
	NewPassword string `json:"new_password"`
}

// ForgotPassword handles POST /api/auth/forgot-password
func (h *PasswordHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}

	if req.Email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Email is required"})
		return
	}

	ctx := context.Background()

	// Check if user exists in either table (don't reveal which)
	userType := ""
	var exists bool

	err := database.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM exec_local_users WHERE email = $1)", req.Email).Scan(&exists)
	if err == nil && exists {
		userType = "LOCAL"
	}

	if userType == "" {
		err = database.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM auth_user WHERE email = $1)", req.Email).Scan(&exists)
		if err == nil && exists {
			userType = "COMPANY"
		}
	}

	// Always return success (don't leak whether email exists)
	if userType == "" {
		writeJSON(w, http.StatusOK, map[string]string{"status": "sent", "message": "If your email is registered, you'll receive a reset code."})
		return
	}

	// Generate 6-digit code
	code := generateCode()

	// Invalidate old codes
	database.Pool.Exec(ctx,
		"UPDATE exec_password_reset_codes SET is_used = true WHERE email = $1 AND is_used = false",
		req.Email,
	)

	// Store new code (expires in 15 minutes)
	_, err = database.Pool.Exec(ctx,
		"INSERT INTO exec_password_reset_codes (email, code, user_type, expires_at) VALUES ($1, $2, $3, $4)",
		req.Email, code, userType, time.Now().Add(15*time.Minute),
	)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to generate reset code"})
		return
	}

	// Send email
	if err := h.Mailer.SendResetCode(req.Email, code); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to send email"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "sent",
		"message": "If your email is registered, you'll receive a reset code.",
	})
}

// VerifyCode handles POST /api/auth/verify-code
func (h *PasswordHandler) VerifyCode(w http.ResponseWriter, r *http.Request) {
	var req verifyCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}

	if req.Email == "" || req.Code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Email and code are required"})
		return
	}

	ctx := context.Background()

	var codeID int
	var userType string
	var expiresAt time.Time
	err := database.Pool.QueryRow(ctx,
		"SELECT id, user_type, expires_at FROM exec_password_reset_codes WHERE email = $1 AND code = $2 AND is_used = false ORDER BY created_at DESC LIMIT 1",
		req.Email, req.Code,
	).Scan(&codeID, &userType, &expiresAt)

	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid or expired code", "valid": "false"})
		return
	}

	if time.Now().After(expiresAt) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Code has expired", "valid": "false"})
		return
	}

	// Generate a short-lived reset token (5 minutes)
	resetToken, err := auth.GenerateToken(h.JWTSecret, codeID, req.Email, "RESET_"+userType, "")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Failed to generate reset token"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"valid":       true,
		"reset_token": resetToken,
	})
}

// ResetPassword handles POST /api/auth/reset-password
func (h *PasswordHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid request"})
		return
	}

	if req.ResetToken == "" || req.NewPassword == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Reset token and new password are required"})
		return
	}

	if len(req.NewPassword) < 6 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Password must be at least 6 characters"})
		return
	}

	// Validate reset token
	claims, err := auth.ValidateToken(h.JWTSecret, req.ResetToken)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "Invalid or expired reset token"})
		return
	}

	ctx := context.Background()
	emailAddr := claims.Email

	// Determine user type from claims
	if claims.UserType == "RESET_LOCAL" {
		hash, err := auth.HashBcryptPassword(req.NewPassword)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Password hashing failed"})
			return
		}
		_, err = database.Pool.Exec(ctx,
			"UPDATE exec_local_users SET password_hash = $1, updated_at = NOW() WHERE email = $2",
			hash, emailAddr,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Password update failed"})
			return
		}
	} else if claims.UserType == "RESET_COMPANY" {
		// For company users, we update auth_user password using Django's PBKDF2 format
		// This is an exception to "read-only" — password reset must work
		hash, err := hashDjangoPassword(req.NewPassword)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Password hashing failed"})
			return
		}
		_, err = database.Pool.Exec(ctx,
			"UPDATE auth_user SET password = $1 WHERE email = $2",
			hash, emailAddr,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Password update failed"})
			return
		}
	} else {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid reset token type"})
		return
	}

	// Mark code as used
	database.Pool.Exec(ctx,
		"UPDATE exec_password_reset_codes SET is_used = true WHERE email = $1 AND is_used = false",
		emailAddr,
	)

	writeJSON(w, http.StatusOK, map[string]string{"status": "success", "message": "Password updated successfully"})
}

// generateCode creates a random 6-digit numeric code.
func generateCode() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(999999))
	return fmt.Sprintf("%06d", n.Int64())
}

// hashDjangoPassword creates a Django-compatible PBKDF2 password hash.
func hashDjangoPassword(password string) (string, error) {
	salt := make([]byte, 12)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	saltStr := fmt.Sprintf("%x", salt)

	iterations := 870000 // Django 4.2+ default
	dk := auth.PBKDF2Key([]byte(password), []byte(saltStr), iterations)
	
	return fmt.Sprintf("pbkdf2_sha256$%d$%s$%s", iterations, saltStr, dk), nil
}
