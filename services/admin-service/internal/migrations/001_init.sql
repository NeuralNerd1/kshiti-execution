-- Execution Platform: Initial Migration
-- Creates exec_ prefixed tables (shared database policy)

-- 1. exec_plans — Available plans and their perks
CREATE TABLE IF NOT EXISTS exec_plans (
    id          SERIAL PRIMARY KEY,
    plan_key    VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    perks_json  JSONB NOT NULL DEFAULT '{}',
    is_visible  BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. exec_local_users — Standalone execution platform users
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

-- 3. exec_password_reset_codes — Verification codes for forgot password
CREATE TABLE IF NOT EXISTS exec_password_reset_codes (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) NOT NULL,
    code        VARCHAR(6) NOT NULL,
    user_type   VARCHAR(20) NOT NULL,  -- 'COMPANY' or 'LOCAL'
    is_used     BOOLEAN NOT NULL DEFAULT false,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Add exec_plan column to existing auth_user (additive only)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'auth_user' AND column_name = 'exec_plan'
    ) THEN
        ALTER TABLE auth_user ADD COLUMN exec_plan VARCHAR(20) DEFAULT 'COMPANY';
    END IF;
END $$;

-- Update all existing company users to COMPANY plan
UPDATE auth_user SET exec_plan = 'COMPANY' WHERE exec_plan IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_exec_local_users_email ON exec_local_users(email);
CREATE INDEX IF NOT EXISTS idx_exec_reset_codes_email ON exec_password_reset_codes(email, is_used);

-- Seed: COMPANY plan (auto-seeded, always present)
INSERT INTO exec_plans (plan_key, display_name, perks_json, is_visible)
VALUES (
    'COMPANY',
    'Company Plan',
    '{"features": ["Unlimited projects", "Team collaboration", "Priority support", "Custom workflows", "Advanced analytics"], "badge_color": "#7c5cff"}',
    true
)
ON CONFLICT (plan_key) DO NOTHING;

-- Seed: FREE plan
INSERT INTO exec_plans (plan_key, display_name, perks_json, is_visible)
VALUES (
    'FREE',
    'Free Plan',
    '{"features": ["1 project", "Basic execution", "Community support"], "badge_color": "#6b7280"}',
    true
)
ON CONFLICT (plan_key) DO NOTHING;

-- Seed: ADVANCE plan
INSERT INTO exec_plans (plan_key, display_name, perks_json, is_visible)
VALUES (
    'ADVANCE',
    'Advanced Plan',
    '{"features": ["5 projects", "Parallel execution", "Email support", "Execution history", "Reports"], "badge_color": "#f59e0b"}',
    true
)
ON CONFLICT (plan_key) DO NOTHING;
