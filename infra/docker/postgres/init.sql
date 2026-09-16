-- SiteFlow database initialisation
-- Runs once when the container is first created.

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";  -- pgvector

-- ─── Schemas ──────────────────────────────────────────────────────────────────
-- All application tables live in the "app" schema.
-- The "public" schema is reserved for extensions.
CREATE SCHEMA IF NOT EXISTS app;

-- Set default search path so the app schema is found automatically
ALTER DATABASE siteflow SET search_path TO app, public;
