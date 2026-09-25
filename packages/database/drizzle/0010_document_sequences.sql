-- Migration: Add document_sequences table

CREATE TYPE "app"."document_sequence_type" AS ENUM (
  'PROJECT',
  'ESTIMATE',
  'INVOICE',
  'PURCHASE_ORDER',
  'CHANGE_ORDER',
  'RFI',
  'SUBMITTAL'
);

CREATE TABLE IF NOT EXISTS "app"."document_sequences" (
  "id"              text PRIMARY KEY,
  "organization_id" text NOT NULL REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
  "type"            "app"."document_sequence_type" NOT NULL,
  "prefix"          text NOT NULL,
  "padding"         integer NOT NULL DEFAULT 4,
  "next_value"      integer NOT NULL DEFAULT 1,
  "updated_at"      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "document_sequences_padding_range"
    CHECK ("padding" >= 1 AND "padding" <= 10),
  CONSTRAINT "document_sequences_next_value_positive"
    CHECK ("next_value" >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_sequences_org_type_unique"
  ON "app"."document_sequences" ("organization_id", "type");
