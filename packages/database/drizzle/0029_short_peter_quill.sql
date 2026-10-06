ALTER TABLE "app"."financial_audit_events" DROP CONSTRAINT "financial_audit_events_project_id_projects_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."financial_audit_events" ADD CONSTRAINT "financial_audit_project_org_fk" FOREIGN KEY ("project_id","organization_id") REFERENCES "app"."projects"("id","organization_id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "app"."financial_audit_events" ADD CONSTRAINT "financial_audit_action_nonempty" CHECK (char_length("app"."financial_audit_events"."action") > 0);--> statement-breakpoint
ALTER TABLE "app"."financial_audit_events" ADD CONSTRAINT "financial_audit_entity_type_nonempty" CHECK (char_length("app"."financial_audit_events"."entity_type") > 0);--> statement-breakpoint
ALTER TABLE "app"."financial_audit_events" ADD CONSTRAINT "financial_audit_entity_id_nonempty" CHECK (char_length("app"."financial_audit_events"."entity_id") > 0);--> statement-breakpoint
ALTER TABLE "app"."financial_audit_events" ADD CONSTRAINT "financial_audit_request_id_nonempty" CHECK (char_length("app"."financial_audit_events"."request_id") > 0);