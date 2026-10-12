-- Phase 11 (Plan 11-03): platform idempotency keys and slug prefix index.
-- Additive and idempotent. Deliberately not registered in Drizzle's journal (same convention as 0048-0051).
-- Keys are scoped to (actor, operation, key hash). Only a SHA-256 of the client key is stored.

CREATE TABLE IF NOT EXISTS "app"."platform_idempotency_keys" (
  "id" text PRIMARY KEY,
  "actor_user_id" text NOT NULL REFERENCES "app"."users"("id") ON DELETE CASCADE,
  "operation" text NOT NULL,
  "key_hash" text NOT NULL,
  "request_hash" text NOT NULL,
  "response_body" jsonb,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT "platform_idempotency_keys_operation_length" CHECK (char_length("operation") BETWEEN 1 AND 128),
  CONSTRAINT "platform_idempotency_keys_hashes_length" CHECK (char_length("key_hash") = 64 AND char_length("request_hash") = 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_idempotency_keys_scope_unique"
  ON "app"."platform_idempotency_keys" ("actor_user_id", "operation", "key_hash");

CREATE INDEX IF NOT EXISTS "platform_idempotency_keys_expires_idx"
  ON "app"."platform_idempotency_keys" ("expires_at");

-- Slug prefix search: btree text_pattern_ops serves LIKE 'prefix%' on lower(slug).
CREATE INDEX IF NOT EXISTS "organizations_slug_lower_pattern_idx"
  ON "app"."organizations" (lower("slug") text_pattern_ops);
