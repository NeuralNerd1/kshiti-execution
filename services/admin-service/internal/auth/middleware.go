package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const UserContextKey contextKey = "user_claims"

// Middleware extracts and validates JWT from Authorization header.
func Middleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"error":"Missing or invalid Authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := ValidateToken(jwtSecret, tokenStr)
			if err != nil {
				http.Error(w, `{"error":"Invalid token"}`, http.StatusUnauthorized)
				return
			}

			// Attach claims to request context
			ctx := context.WithValue(r.Context(), UserContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// AdminMiddleware checks for admin secret in X-Admin-Secret header.
func AdminMiddleware(adminSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			secret := r.Header.Get("X-Admin-Secret")
			if secret == "" || secret != adminSecret {
				http.Error(w, `{"error":"Unauthorized: invalid admin secret"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// GetClaims extracts Claims from request context.
func GetClaims(r *http.Request) *Claims {
	claims, ok := r.Context().Value(UserContextKey).(*Claims)
	if !ok {
		return nil
	}
	return claims
}
