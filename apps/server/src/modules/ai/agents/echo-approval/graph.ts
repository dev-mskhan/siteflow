// apps/server/src/modules/ai/agents/echo-approval/graph.ts
//
// Zero-LLM test agent with a BINDING tool interrupt to verify:
//   interrupt → create approval → approve/reject → resume from checkpoint

import { StateGraph, Annotation, END, interrupt } from '@langchain/langgraph';
import type { RunContext } from '../../core/run-context.js';
import type { AgentRunOutput } from '../../core/types.js';
import { executeTool } from '../../tools/tool-factory.js';
import { ApprovalService } from '../../approvals/approval.service.js';
import { createHash } from 'node:crypto';

const EchoApprovalState = Annotation.Root({
  input: Annotation<Record<string, unknown>>(),
  output: Annotation<AgentRunOutput | null>({ default: () => null, reducer: (_, b) => b }),
  approvalRequested: Annotation<boolean>({ default: () => false, reducer: (_, b) => b }),
});

export function buildEchoApprovalGraph(ctx: RunContext) {
  const approvalService = new ApprovalService();

  async function stepNode(state: typeof EchoApprovalState.State): Promise<Partial<typeof EchoApprovalState.State>> {
    const toolArgs = {
      amount: Number(state.input.amount ?? 100),
      action: String(state.input.action ?? 'test_action'),
    };

    // 1. If not approved yet, check or create approval and interrupt
    const pendingApproval = await approvalService.getPendingForRun(ctx.runId);
    if (!pendingApproval) {
      const sortedArgs = JSON.stringify(toolArgs, Object.keys(toolArgs).sort());
      const argsHash = createHash('sha256').update(sortedArgs).digest('hex');

      await approvalService.createApproval({
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        proposalType: 'TEST_BINDING_ACTION',
        proposal: toolArgs,
        approvedToolName: 'fake_approve_something',
        approvedArgsHash: argsHash,
      });
    }

    // Graph interrupt — pauses execution and awaits human sign-off
    const resumeValue = interrupt({
      tool: 'fake_approve_something',
      proposal: toolArgs,
    }) as { approved?: boolean; approvalId?: string; proposal?: Record<string, unknown> } | undefined;

    // Resumed — execute the BINDING tool within the safety envelope
    const toolResult = await executeTool(
      'fake_approve_something',
      resumeValue?.proposal ?? toolArgs,
      ctx,
    );

    const output: AgentRunOutput = {
      answer: toolResult.ok ? toolResult.data : { error: toolResult.message },
      summary: toolResult.ok ? 'Approved binding action executed successfully.' : `Failed: ${toolResult.message}`,
      citations: [{ toolName: 'fake_approve_something', snippet: JSON.stringify(toolArgs) }],
    };

    return { output, approvalRequested: true };
  }

  const graph = new StateGraph(EchoApprovalState)
    .addNode('step', stepNode)
    .addEdge('__start__', 'step')
    .addEdge('step', END);

  return graph;
}

export const ECHO_APPROVAL_AGENT_NAME = 'echo-approval' as const;
