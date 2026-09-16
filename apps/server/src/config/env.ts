// apps/server/src/config/env.ts
// Re-exports validated server env from @siteflow/env.
// Other server files import from here, not directly from the package,
// so there's a single place to swap/mock env in tests.
export { serverEnv } from '@siteflow/env/server';
export type { ServerEnv } from '@siteflow/env/server';
