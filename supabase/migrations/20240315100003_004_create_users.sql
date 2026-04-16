-- Migration 004: Create users and user_stores tables
-- Requirements: 11.1, 11.5, 11.6

-- ─── User Role Enum ──────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'manager', 'seller');

-- ─── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL,
  full_name             TEXT NOT NULL,
  role                  user_role NOT NULL DEFAULT 'seller',
  is_active             BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  last_login_at         TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT users_email_not_empty CHECK (char_length(email) > 0),
  CONSTRAINT users_full_name_not_empty CHECK (char_length(full_name) > 0),
  CONSTRAINT users_failed_login_attempts_non_negative CHECK (failed_login_attempts >= 0)
);

-- Indexes
CREATE UNIQUE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_is_active ON users (is_active);

COMMENT ON TABLE users IS 'Application users linked to Supabase Auth. Stores profile, role, and login tracking info.';

-- ─── User–Store Assignments ──────────────────────────────────────────────────

CREATE TABLE user_stores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE UNIQUE INDEX idx_user_stores_user_store ON user_stores (user_id, store_id);
CREATE INDEX idx_user_stores_store_id ON user_stores (store_id);

COMMENT ON TABLE user_stores IS 'Many-to-many assignment of users to stores. Controls which stores a user can access.';
