// apps/server/src/modules/ai/graph/checkpointer.ts
//
// Singleton PostgresSaver — shared across all runs in a worker process.
// Uses the existing DATABASE_URL; checkpoints live in schema "langgraph".
// (Separate from "pgboss" and "app" schemas to avoid naming collisions.)
//
// Lifecycle:
//   getCheckpointer()  — returns the singleton, calling setup() once on first call
//   teardownCheckpointer() — called during worker graceful shutdown

import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { serverEnv } from '../../../config/env.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'ai-checkpointer' });

let _instance: PostgresSaver | undefined;
let _setupPromise: Promise<void> | undefined;

/**
 * Returns the singleton PostgresSaver, initialising it on first call.
 * Idempotent — safe to call from multiple concurrent workers.
 */
export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!_instance) {
    _instance = PostgresSaver.fromConnString(serverEnv.DATABASE_URL, {
      // Dedicated schema keeps LangGraph tables away from app + pgboss tables
      schema: 'langgraph',
    });
  }

  // setup() creates the checkpoint tables if they don't exist (idempotent)
  if (!_setupPromise) {
    _setupPromise = _instance
      .setup()
      .then(() => logger.info('LangGraph checkpointer ready (schema: langgraph)'))
      .catch((err) => {
        logger.error({ err }, 'Checkpointer setup failed');
        // Reset so the next call retries
        _setupPromise = undefined;
        throw err;
      });
  }

  await _setupPromise;
  return _instance;
}

/**
 * Tear down the checkpointer connection pool.
 * Call this in the worker's graceful shutdown handler.
 */
export async function teardownCheckpointer(): Promise<void> {
  if (_instance) {
    try {
      // PostgresSaver wraps a pg.Pool — end() drains it cleanly
      await (_instance as any).db?.end?.();
    } catch (err) {
      logger.warn({ err }, 'Checkpointer teardown error (ignored)');
    }
    _instance = undefined;
    _setupPromise = undefined;
    logger.info('LangGraph checkpointer torn down');
  }
}
