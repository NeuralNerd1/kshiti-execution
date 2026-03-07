package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/kshiti/exec-admin-service/internal/config"
	"github.com/kshiti/exec-admin-service/internal/database"
	"github.com/kshiti/exec-admin-service/internal/router"
)

func main() {
	// ── Load Configuration ─────────────────────────────────────────────
	cfg := config.Load()

	// ── Connect to Database ────────────────────────────────────────────
	database.Connect(cfg.DatabaseURL)
	defer database.Close()

	// ── Run Migrations ─────────────────────────────────────────────────
	runMigrations()

	// ── Create Router ──────────────────────────────────────────────────
	r := router.New(cfg)

	// ── Start Server ───────────────────────────────────────────────────
	server := &http.Server{
		Addr:         ":" + cfg.ServerPort,
		Handler:      r,
		ReadTimeout:  5 * time.Minute,
		WriteTimeout: 5 * time.Minute,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		log.Println("Shutting down server...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		server.Shutdown(ctx)
	}()

	log.Printf("🚀 Execution Admin Service running on :%s", cfg.ServerPort)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}

func runMigrations() {
	ctx := context.Background()
	migrationSQL := `
-- Execution Platform: Auto-migration
CREATE TABLE IF NOT EXISTS exec_plans (
    id          SERIAL PRIMARY KEY,
    plan_key    VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    perks_json  JSONB NOT NULL DEFAULT '{}',
    is_visible  BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exec_local_users (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  VARCHAR(150) NOT NULL DEFAULT '',
    plan          VARCHAR(20) NOT NULL DEFAULT 'FREE',
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exec_local_projects (
    id            SERIAL PRIMARY KEY,
    user_id       INT NOT NULL REFERENCES exec_local_users(id) ON DELETE CASCADE,
    name          VARCHAR(150) NOT NULL,
    description   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exec_password_reset_codes (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    code        VARCHAR(6) NOT NULL,
    user_type   VARCHAR(20) NOT NULL,
    is_used     BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exec_runs (
    run_id       VARCHAR(100) PRIMARY KEY,
    project_id   VARCHAR(100) NOT NULL,
    company_slug VARCHAR(100) NOT NULL DEFAULT 'default',
    suite_name   VARCHAR(255) NOT NULL,
    status       VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    start_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time     TIMESTAMPTZ,
    duration_ms  BIGINT NOT NULL DEFAULT 0,
    tests_passed INT NOT NULL DEFAULT 0,
    tests_failed INT NOT NULL DEFAULT 0,
    test_cases   JSONB NOT NULL DEFAULT '[]',
    logs         JSONB NOT NULL DEFAULT '[]',
    triggered_by VARCHAR(150) NOT NULL DEFAULT 'User'
);

-- Ensure columns exist in case the table was created previously without them
ALTER TABLE exec_runs ADD COLUMN IF NOT EXISTS test_cases JSONB NOT NULL DEFAULT '[]';
ALTER TABLE exec_runs ADD COLUMN IF NOT EXISTS logs JSONB NOT NULL DEFAULT '[]';
ALTER TABLE exec_runs ADD COLUMN IF NOT EXISTS company_slug VARCHAR(100) NOT NULL DEFAULT 'default';
ALTER TABLE exec_runs ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(150) NOT NULL DEFAULT 'User';
ALTER TABLE exec_runs ADD COLUMN IF NOT EXISTS payload JSONB;

CREATE TABLE IF NOT EXISTS exec_configs (
    project_id VARCHAR(100) PRIMARY KEY,
    config JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add exec_plan column to auth_user (additive only)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'auth_user' AND column_name = 'exec_plan'
    ) THEN
        ALTER TABLE auth_user ADD COLUMN exec_plan VARCHAR(20) DEFAULT 'COMPANY';
    END IF;
END $$;

UPDATE auth_user SET exec_plan = 'COMPANY' WHERE exec_plan IS NULL;

CREATE INDEX IF NOT EXISTS idx_exec_local_users_email ON exec_local_users(email);
CREATE INDEX IF NOT EXISTS idx_exec_reset_codes_email ON exec_password_reset_codes(email, is_used);
CREATE INDEX IF NOT EXISTS idx_exec_runs_project_id ON exec_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_exec_runs_status ON exec_runs(status);

-- Seed plans
INSERT INTO exec_plans (plan_key, display_name, perks_json, is_visible) VALUES
    ('COMPANY', 'Company Plan', '{"features":["Unlimited projects","Team collaboration","Priority support","Custom workflows","Advanced analytics"],"badge_color":"#7c5cff"}', true),
    ('FREE', 'Free Plan', '{"features":["1 project","Basic execution","Community support"],"badge_color":"#6b7280"}', true),
    ('ADVANCE', 'Advanced Plan', '{"features":["5 projects","Parallel execution","Email support","Execution history","Reports"],"badge_color":"#f59e0b"}', true)
ON CONFLICT (plan_key) DO NOTHING;
`
	_, err := database.Pool.Exec(ctx, migrationSQL)
	if err != nil {
		log.Printf("⚠ Migration warning: %v", err)
	} else {
		log.Println("✓ Database migrations applied")
	}
}
