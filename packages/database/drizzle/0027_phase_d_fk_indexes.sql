CREATE INDEX IF NOT EXISTS "doc_num_allocator_project_idx" ON "app"."document_number_allocators" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quality_deficiencies_created_by_idx" ON "app"."quality_deficiencies" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quality_inspections_created_by_idx" ON "app"."quality_inspections" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfis_created_by_idx" ON "app"."rfis" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfis_submitted_by_idx" ON "app"."rfis" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rfis_responded_by_idx" ON "app"."rfis" USING btree ("responded_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittal_revision_reviews_org_idx" ON "app"."submittal_revision_reviews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittal_revision_reviews_reviewed_by_idx" ON "app"."submittal_revision_reviews" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittal_revisions_submitted_by_idx" ON "app"."submittal_revisions" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittal_revisions_reviewed_by_idx" ON "app"."submittal_revisions" USING btree ("reviewed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submittals_created_by_idx" ON "app"."submittals" USING btree ("created_by");