// apps/server/src/modules/ai/index.ts
// AI module barrel — exports the route plugin and the worker registrar.
// app/index.ts imports routes; lib/queue worker bootstrap imports registerAiWorkers.

// Import tool definitions and agent registry for side-effect registrations
import './tools/definitions/cost.tools.js';
import './tools/definitions/test.tools.js';
import './core/agent-registry.js';

export { agentRunRoutes } from './runs/agent-run.routes.js';
export { approvalRoutes } from './approvals/approval.routes.js';
export { conversationRoutes } from './conversations/conversation.routes.js';
export { registerAgentRunWorkers } from './workers/agent-run.worker.js';
