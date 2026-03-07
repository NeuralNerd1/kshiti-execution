package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all application configuration.
type Config struct {
	DatabaseURL  string
	JWTSecret    string
	BridgeAPIURL string
	BridgeAPIKey string
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPass     string
	SMTPFrom     string
	ServerPort   string
	AdminSecret  string
	CORSOrigins  []string
	SupabaseURL  string
	SupabaseKey  string
}

// Load reads config from .env file and environment variables.
func Load() *Config {
	// Load .env file (non-fatal if missing)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	cfg := &Config{
		DatabaseURL:  getEnv("DATABASE_URL", ""),
		JWTSecret:    getEnv("JWT_SECRET", "unsafe-local-dev-key"),
		BridgeAPIURL: getEnv("BRIDGE_API_URL", "http://localhost:8000/bridge"),
		BridgeAPIKey: getEnv("BRIDGE_API_KEY", ""),
		SMTPHost:     getEnv("SMTP_HOST", ""),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUser:     getEnv("SMTP_USER", ""),
		SMTPPass:     getEnv("SMTP_PASS", ""),
		SMTPFrom:     getEnv("SMTP_FROM", "noreply@kshiti.io"),
		ServerPort:   getEnv("SERVER_PORT", "8081"),
		AdminSecret:  getEnv("ADMIN_SECRET", ""),
		CORSOrigins:  strings.Split(getEnv("CORS_ORIGINS", "http://localhost:3001"), ","),
		SupabaseURL:  getEnv("SUPABASE_URL", ""),
		SupabaseKey:  getEnv("SUPABASE_KEY", ""),
	}

	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}
