// apps/server/tests/autonomous-e2e/harness/index.ts
// Export all harness components

export { GeminiWrapper, BudgetExceededError } from './gemini-wrapper.js';
export { TraceCollector } from './trace-collector.js';
export type { TraceData, ToolCallTrace } from './trace-collector.js';
export { Judge } from './judge.js';
export type { GroundednessResult, HelpfulnessResult, ToneResult, RoutingResult } from './judge.js';
export { createScenario, EXAMPLE_SCENARIOS } from './scenario-dsl.js';
export type { Scenario, Turn, DBAssertion, LangfuseAssertion, Persona } from './scenario-dsl.js';
export { generatePersonaConversation, getPersonaDescription } from './persona-simulator.js';
export type { ConversationTurn, PersonaConfig } from './persona-simulator.js';
export {
  wilsonCI,
  calculatePercentiles,
  calculatePassAtK,
  calculateStats,
  chiSquaredTest,
  formatStats,
  formatRate,
} from './stats.js';
