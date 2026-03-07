package models

import "time"

// Plan represents an available subscription plan.
type Plan struct {
	ID          int             `json:"id"`
	PlanKey     string          `json:"plan_key"`
	DisplayName string          `json:"display_name"`
	PerksJSON   map[string]any  `json:"perks_json"`
	IsVisible   bool            `json:"is_visible"`
	CreatedAt   time.Time       `json:"created_at"`
}

// ResetCode represents a password reset verification code.
type ResetCode struct {
	ID        int       `json:"id"`
	Email     string    `json:"email"`
	Code      string    `json:"code"`
	UserType  string    `json:"user_type"`
	IsUsed    bool      `json:"is_used"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}
