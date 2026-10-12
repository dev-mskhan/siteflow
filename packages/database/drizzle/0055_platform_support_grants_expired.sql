ALTER TABLE "app"."platform_support_grants" DROP CONSTRAINT "platform_support_grants_status_check";--> statement-breakpoint
ALTER TABLE "app"."platform_support_grants" ADD CONSTRAINT "platform_support_grants_status_check"
  CHECK ("status" IN ('pending', 'active', 'rejected', 'revoked', 'expired'));
