package auth

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the JWT payload.
type Claims struct {
	UserID   int    `json:"user_id"`
	Email    string `json:"email"`
	UserType string `json:"user_type"` // "COMPANY" or "LOCAL"
	Plan     string `json:"plan"`
	jwt.RegisteredClaims
}

// GenerateToken creates a new JWT token for the given user.
func GenerateToken(secret string, userID int, email, userType, plan string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Email:    email,
		UserType: userType,
		Plan:     plan,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)), // 30 days
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "exec-platform",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateToken verifies and parses a JWT token.
func ValidateToken(secret, tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
