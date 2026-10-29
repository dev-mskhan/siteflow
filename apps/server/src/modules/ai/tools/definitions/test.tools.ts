// apps/server/src/modules/ai/tools/definitions/test.tools.ts
//
// Test tools used by echo-approval, echo-loop, and echo-slow agents to verify safety guarantees.

import { z } from 'zod';
import { registerTool } from '../tool-registry.js';

// ── 1. fake_approve_something (BINDING tool) ──────────────────────────────────
registerTool({
  name: 'fake_approve_something',
  description: 'A mock binding action that requires human sign-off before completion.',
  argsSchema: z.object({
    amount: z.number().default(100),
    action: z.string().default('test_action'),
  }),
  riskTier: 'BINDING',
  requiredPermission: '',
  async execute(args) {
    return { status: 'EXECUTED', args };
  },
});

// ── 2. fake_read_loop (READ tool) ─────────────────────────────────────────────
registerTool({
  name: 'fake_read_loop',
  description: 'A mock read tool used in loop testing.',
  argsSchema: z.object({
    iteration: z.number().default(0),
  }),
  riskTier: 'READ',
  requiredPermission: '',
  async execute(args) {
    return { iteration: args.iteration, timestamp: Date.now() };
  },
});

// ── 3. fake_sleep (READ tool) ─────────────────────────────────────────────────
registerTool({
  name: 'fake_sleep',
  description: 'A mock tool that sleeps to test timeouts and cancellation.',
  argsSchema: z.object({
    durationMs: z.number().default(5000),
  }),
  riskTier: 'READ',
  requiredPermission: '',
  async execute(args) {
    await new Promise((resolve) => setTimeout(resolve, args.durationMs));
    return { sleptMs: args.durationMs };
  },
});
