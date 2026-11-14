-- Migration: Contact Requests
-- Description: Add contact_requests table for demo requests, trial signups, and general inquiries
-- Created: 2026-11-14

-- Create contact request status enum
CREATE TYPE app.contact_request_status AS ENUM (
  'new',
  'contacted',
  'qualified',
  'converted',
  'spam',
  'closed'
);

-- Create contact request intent enum
CREATE TYPE app.contact_request_intent AS ENUM (
  'trial',
  'demo',
  'pricing',
  'subcontractor',
  'other'
);

-- Create contact_requests table
CREATE TABLE app.contact_requests (
  id TEXT PRIMARY KEY,
  
  -- Contact information
  name TEXT NOT NULL,
  work_email TEXT NOT NULL,
  phone TEXT,
  
  -- Company information
  company_name TEXT NOT NULL,
  company_size TEXT NOT NULL, -- '1-10', '11-50', '51-200', '200+'
  country TEXT NOT NULL,
  
  -- Request details
  intent app.contact_request_intent NOT NULL,
  message TEXT NOT NULL,
  
  -- Metadata
  status app.contact_request_status NOT NULL DEFAULT 'new',
  user_agent TEXT,
  ip_address TEXT,
  referrer_url TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  
  -- Notes for sales team
  internal_notes TEXT
);

-- Create indexes for common queries
CREATE INDEX idx_contact_requests_status ON app.contact_requests(status);
CREATE INDEX idx_contact_requests_intent ON app.contact_requests(intent);
CREATE INDEX idx_contact_requests_work_email ON app.contact_requests(work_email);
CREATE INDEX idx_contact_requests_created_at ON app.contact_requests(created_at DESC);
CREATE INDEX idx_contact_requests_status_created ON app.contact_requests(status, created_at DESC);

-- Add comment
COMMENT ON TABLE app.contact_requests IS 'Stores inbound contact form submissions from the website including demo requests, trial signups, pricing inquiries, and general contact requests';
