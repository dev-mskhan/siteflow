// apps/server/src/modules/ai/index.ts
// AI module barrel — exports the route plugin and the worker registrar.
// app/index.ts imports routes; lib/queue worker bootstrap imports registerAiWorkers.

export { agentRunRoutes } from './runs/agent-run.routes.js';
export { approvalRoutes } from './approvals/approval.routes.js';
export { registerAgentRunWorkers } from './workers/agent-run.worker.js';
