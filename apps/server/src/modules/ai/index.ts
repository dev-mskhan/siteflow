// apps/server/src/modules/ai/index.ts
// AI module barrel — exports the route plugin and the worker registrar.
// app/index.ts imports routes; lib/queue worker bootstrap imports registerAiWorkers.

// Import tool definitions and agent registry for side-effect registrations
import './tools/definitions/cost.tools.js';
import './tools/definitions/procurement.tools.js';
import './tools/definitions/knowledge.tools.js';
import './tools/definitions/compliance.tools.js';
import './tools/definitions/estimating-boq.tools.js';
import './tools/definitions/test.tools.js';
// import './tools/definitions/binding.tools.js'; // TODO: Enable after ToolApprovalService is implemented
import './core/agent-registry.js';

export { agentRunRoutes } from './runs/agent-run.routes.js';
export { approvalRoutes } from './approvals/approval.routes.js';
export { conversationRoutes } from './conversations/conversation.routes.js';
export { voiceRoutes } from './voice/voice.routes.js';
export { aiUsageRoutes } from './usage/ai-usage.routes.js';
export { registerAgentRunWorkers } from './workers/agent-run.worker.js';
export { registerAiTranscribeWorker } from './voice/transcribe.worker.js';
export { registerAiReaperWorker, runReaperSweep } from './workers/reaper.worker.js';
export { registerIngestionWorker } from './ingestion/ingestion.worker.js';
