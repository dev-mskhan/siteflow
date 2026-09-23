// apps/server/src/index.ts — HTTP server entry point
//
// ⚠️  OTEL is bootstrapped via --import @siteflow/observability/server/register
//     in the dev/start scripts. This ensures the SDK patches pg, ioredis,
//     fastify etc. before their modules are first loaded (ESM hoisting caveat).
// ─── Remaining imports (after OTEL bootstrap) ─────────────────────────────────
import { buildApp } from './app/index.js';
import { serverEnv } from './config/env.js';

const start = async () => {
  const app = await buildApp();

  try {
    await app.listen({ port: serverEnv.PORT, host: serverEnv.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
