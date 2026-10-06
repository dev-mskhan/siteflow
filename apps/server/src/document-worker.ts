import { createLogger } from '@siteflow/observability/server';
import { startQueue, stopQueue } from './lib/queue/index.js';
import { registerDocumentWorkers } from './modules/project/documents/document.worker.js';

const logger = createLogger({ name: 'document-worker-process' });

async function runDocumentWorker(): Promise<void> {
  const boss = await startQueue();
  await registerDocumentWorkers(boss);
  logger.info('Dedicated document processing worker is ready');
}

runDocumentWorker().catch((err) => {
  logger.error({ err }, 'Document processing worker failed to start');
  process.exit(1);
});

let isShuttingDown = false;
const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info('Document processing worker shutting down');
  await stopQueue();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
