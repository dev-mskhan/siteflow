-- 0064_ai_approval_expiry_constraint.sql
-- Allow EXPIRED status on agent_approvals when decided_by and decided_at are null (reaper-swept approvals)

ALTER TABLE "app"."agent_approvals" DROP CONSTRAINT IF EXISTS "agent_approvals_decision_metadata_check";
ALTER TABLE "app"."agent_approvals" ADD CONSTRAINT "agent_approvals_decision_metadata_check"
  CHECK ("status" IN ('PENDING', 'EXPIRED') OR ("decided_by" IS NOT NULL AND "decided_at" IS NOT NULL));
