package auth

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/pbkdf2"
	"golang.org/x/crypto/bcrypt"
)

// VerifyBcryptPassword checks a plaintext password against a bcrypt hash.
// Used for exec_local_users.
func VerifyBcryptPassword(plaintext, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext))
	return err == nil
}

// HashBcryptPassword creates a bcrypt hash for a plaintext password.
func HashBcryptPassword(plaintext string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(plaintext), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// VerifyDjangoPassword checks a plaintext password against Django's PBKDF2 hash.
// Django format: pbkdf2_sha256$<iterations>$<salt>$<hash>
// Used for company users from auth_user table.
func VerifyDjangoPassword(plaintext, djangoHash string) bool {
	parts := strings.Split(djangoHash, "$")
	if len(parts) != 4 {
		return false
	}

	algorithm := parts[0]
	if algorithm != "pbkdf2_sha256" {
		return false
	}

	iterations := 0
	_, err := fmt.Sscanf(parts[1], "%d", &iterations)
	if err != nil || iterations == 0 {
		return false
	}

	salt := parts[2]
	expectedHash := parts[3]

	// Compute PBKDF2 hash
	dk := pbkdf2.Key([]byte(plaintext), []byte(salt), iterations, sha256.Size, sha256.New)
	computedHash := base64.StdEncoding.EncodeToString(dk)

	return computedHash == expectedHash
}

// PBKDF2Key generates a Django-compatible PBKDF2 hash and returns it as base64.
func PBKDF2Key(password, salt []byte, iterations int) string {
	dk := pbkdf2.Key(password, salt, iterations, sha256.Size, sha256.New)
	return base64.StdEncoding.EncodeToString(dk)
}
