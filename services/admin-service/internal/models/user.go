package models

import "time"

// LocalUser represents a standalone execution platform user.
type LocalUser struct {
	ID           int       `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	DisplayName  string    `json:"display_name"`
	Plan         string    `json:"plan"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// CompanyUser represents a user from the planning app's auth_user table (read-only).
type CompanyUser struct {
	ID        int    `json:"id"`
	Email     string `json:"email"`
	Password  string `json:"-"` // Django PBKDF2 hash
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	IsActive  bool   `json:"is_active"`
	ExecPlan  string `json:"exec_plan"`
}

// AuthUser is the unified user response for the frontend.
type AuthUser struct {
	ID          int    `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"display_name"`
	Plan        string `json:"plan"`
	UserType    string `json:"user_type"` // "COMPANY" or "LOCAL"
}
