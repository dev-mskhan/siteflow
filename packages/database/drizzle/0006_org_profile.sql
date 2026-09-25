-- Migration: Add organization_profiles table

CREATE TYPE "app"."business_type" AS ENUM (
  'GENERAL_CONTRACTOR',
  'SUBCONTRACTOR',
  'SPECIALTY_CONTRACTOR',
  'DESIGN_BUILD',
  'DEVELOPER',
  'CONSULTANT',
  'OTHER'
);

CREATE TABLE IF NOT EXISTS "app"."organization_profiles" (
  "organization_id"            text PRIMARY KEY REFERENCES "app"."organizations"("id") ON DELETE CASCADE,
  "legal_name"                 text,
  "business_name"              text,
  "business_type"              "app"."business_type",
  "registration_number"        text,
  "tax_identification_number"  text,
  "primary_email"              text,
  "primary_phone"              text,
  "secondary_phone"            text,
  "website"                    text,
  "address_line_1"             text,
  "address_line_2"             text,
  "city"                       text,
  "state_province"             text,
  "postal_code"                text,
  "country"                    text,
  "created_at"                 timestamptz NOT NULL DEFAULT now(),
  "updated_at"                 timestamptz NOT NULL DEFAULT now()
);
