// apps/server/src/index.ts — HTTP server entry point
//
// ⚠️  OTEL is bootstrapped via --import @siteflow/observability/server/register
//     in the dev/start scripts. This ensures the SDK patches pg, ioredis,
//     fastify etc. before their modules are first loaded (ESM hoisting caveat).
// ─── Remaining imports (after OTEL bootstrap) ─────────────────────────────────
import { buildApp } from './app/index.js';
import { serverEnv } from './config/env.js';
import { stopQueue } from './lib/queue/index.js';

const start = async () => {
  const app = await buildApp();

  // ── Gap 7: Graceful shutdown ────────────────────────────────────────────────
  // On SIGTERM (Kubernetes pod eviction, rolling deploy) or SIGINT (Ctrl-C in dev),
  // close Fastify first (stops accepting new requests, drains in-flight ones),
  // then stop PgBoss (flushes pending jobs), then exit cleanly.
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutdown signal received');
    try {
      await app.close();
      app.log.info('Fastify closed — draining queue');
      await stopQueue();
      app.log.info('Queue stopped — exiting');
    } catch (err) {
      app.log.error({ err }, 'Error during graceful shutdown');
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT',  () => { void shutdown('SIGINT'); });

  try {
    await app.listen({ port: serverEnv.PORT, host: serverEnv.HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
