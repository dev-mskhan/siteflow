-- Migration: Wave 5 - OKF Pages and Tool Approvals
-- Created: 2024-01-15

-- ============================================================================
-- OKF Pages (Learning Loop)
-- ============================================================================

CREATE TYPE app.okf_page_status AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'ARCHIVED');
CREATE TYPE app.okf_page_source AS ENUM ('AGENT_CORRECTION', 'MANUAL', 'IMPORTED');

CREATE TABLE app.okf_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    page_path VARCHAR(500) NOT NULL,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    status app.okf_page_status NOT NULL DEFAULT 'DRAFT',
    version INTEGER NOT NULL DEFAULT 1,
    source app.okf_page_source NOT NULL,
    correction_context JSONB,
    created_by UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES app.users(id),
    approved_at TIMESTAMP,
    approval_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id, page_path)
);

CREATE INDEX idx_okf_pages_org_status ON app.okf_pages(organization_id, status);
CREATE INDEX idx_okf_pages_org_path ON app.okf_pages(organization_id, page_path);
CREATE INDEX idx_okf_pages_status ON app.okf_pages(status);

-- ============================================================================
-- Tool Approvals (Binding Tools)
-- ============================================================================

CREATE TYPE app.tool_approval_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE app.tool_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
    tool_name VARCHAR(100) NOT NULL,
    requested_by UUID NOT NULL REFERENCES app.users(id) ON DELETE CASCADE,
    request_context JSONB NOT NULL,
    tool_args JSONB NOT NULL,
    status app.tool_approval_status NOT NULL DEFAULT 'PENDING',
    approved_by UUID REFERENCES app.users(id),
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_tool_approvals_org_status ON app.tool_approvals(organization_id, status);
CREATE INDEX idx_tool_approvals_status ON app.tool_approvals(status);
CREATE INDEX idx_tool_approvals_expires ON app.tool_approvals(expires_at) WHERE status = 'PENDING';

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE app.okf_pages IS 'Learning loop: Agent-proposed knowledge pages requiring approval';
COMMENT ON TABLE app.tool_approvals IS 'Binding tools approval gate: requires human confirmation before execution';

COMMENT ON COLUMN app.okf_pages.page_path IS 'Unique path like "corrections/cost-code-naming"';
COMMENT ON COLUMN app.okf_pages.correction_context IS 'Original question, agent answer, user correction';
COMMENT ON COLUMN app.tool_approvals.expires_at IS 'Auto-reject after 24h if not approved';
