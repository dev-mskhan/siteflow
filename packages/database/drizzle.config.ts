import { defineConfig } from 'drizzle-kit';

// drizzle.config.ts lives at the package root so `drizzle-kit` can find it.
// Run: pnpm --filter @siteflow/database db:generate

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'postgres://siteflow:siteflow@localhost:5433/siteflow',
  },
  // All app tables live in the "app" schema (created by init.sql)
  schemaFilter: ['app'],
  verbose: true,
  strict: true,
});
