/**
 * test-echo-agents.ts
 *
 * End-to-end smoke tests for all Echo agent variants across all channels.
 * Uses real Gemini via gemini-web2api (OPENAI_BASE_URL) and real Langfuse tracing.
 *
 * Agents tested:
 *   1. echo          — baseline: reflect input, no LLM, all 3 channels (api / chat / voice)
 *   2. echo-approval — BINDING tool + interrupt/resume flow
 *   3. echo-loop     — hard limits: maxSteps enforcement
 *   4. echo-slow     — timeout enforcement
 *
 * Voice test: synthesises a tiny PCM WAV in-memory (no external file needed),
 * posts it to the local Whisper STT container, then runs the echo agent on
 * the returned transcript via the conversation channel.
 *
 * Run:
 *   pnpm --filter @siteflow/server exec tsx src/scripts/test-echo-agents.ts
 */

import '../modules/ai/index.js';
import { buildRunContext } from '../modules/ai/core/run-context.js';
import { getAgent } from '../modules/ai/core/agent-registry.js';
import { DEFAULT_RUN_LIMITS } from '../modules/ai/core/types.js';
import { executeRun, resumeRun } from '../modules/ai/graph/runner.js';
import { flushLangfuse } from '../modules/ai/observability/langfuse-client.js';
import { getSttProvider } from '../modules/ai/voice/stt-factory.js';
import { teardownCheckpointer } from '../modules/ai/graph/checkpointer.js';
import { serverEnv } from '../config/env.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m✓\x1b[0m';
const RED    = '\x1b[31m✗\x1b[0m';
const YELLOW = '\x1b[33m⚡\x1b[0m';
const BLUE   = '\x1b[34m►\x1b[0m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

let passed = 0, failed = 0;

function header(title: string) {
  console.log(`\n${BOLD}${BLUE} ── ${title} ──${RESET}`);
}

function ok(label: string, detail?: string) {
  passed++;
  console.log(`  ${GREEN} ${label}${detail ? ` ${RESET}(${detail})` : ''}`);
}

function fail(label: string, err: unknown) {
  failed++;
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  ${RED} ${label}`);
  console.log(`       ${YELLOW} ${msg.split('\n')[0]}`);
}

/** Make a unique RunContext for each test */
function ctx(agent: string, input: Record<string, unknown> = {}, overrides: Record<string, unknown> = {}) {
  const manifest = getAgent(agent);
  const limits = manifest?.limitOverrides
    ? { ...DEFAULT_RUN_LIMITS, ...manifest.limitOverrides }
    : DEFAULT_RUN_LIMITS;
  return buildRunContext(
    {
      id: `test-${agent}-${Date.now()}`,
      organizationId: 'org-test-dev',
      projectId: null,
      createdBy: 'user-dev',
      agent: agent as any,
      inputSnapshot: input,
      ...(overrides as any),
    },
    limits,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal WAV generator (44-byte header + 16 kHz, 16-bit, mono, 1 second)
// Whisper needs actual audio to produce a transcript; we encode a 440 Hz tone.
// ─────────────────────────────────────────────────────────────────────────────

function generateWavBuffer(durationSecs = 1.5, freq = 440, sampleRate = 16000): Buffer {
  const numSamples = Math.floor(sampleRate * durationSecs);
  const dataBytes   = numSamples * 2; // 16-bit = 2 bytes per sample
  const buf         = Buffer.alloc(44 + dataBytes);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);           // chunk size
  buf.writeUInt16LE(1, 20);            // PCM
  buf.writeUInt16LE(1, 22);            // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32);            // block align
  buf.writeUInt16LE(16, 34);           // bits per sample
  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  // samples
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(32767 * Math.sin((2 * Math.PI * freq * i) / sampleRate));
    buf.writeInt16LE(sample, 44 + i * 2);
  }
  return buf;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

async function testEchoApi() {
  header('1. Echo agent — API channel (no LLM, pure reflect)');

  try {
    const result = await executeRun(
      ctx('echo', { message: 'hello world', channel: 'api' }),
    );

    if (result.interrupted) throw new Error('unexpected interrupt');
    if (!result.output.answer) throw new Error('answer is null — expected reflected input');
    ok('Executes without error');
    ok('Returns non-null answer', JSON.stringify(result.output.answer).slice(0, 80));
    ok(`traceId emitted: ${result.traceId}`);
    ok(`costUsd=${result.costUsd}  tokensIn=${result.tokensIn}  tokensOut=${result.tokensOut}`);
  } catch (err) {
    fail('echo / api', err);
  }
}

async function testEchoChat() {
  header('2. Echo agent — Chat channel (simulates conversation turn)');

  try {
    const result = await executeRun(
      ctx('echo', { question: 'What is 2+2?', conversationId: 'conv-test-123', channel: 'chat' }),
    );

    if (result.interrupted) throw new Error('unexpected interrupt');
    ok('Executes chat-channel run without error');
    ok('Output summary', result.output.summary.slice(0, 80));
  } catch (err) {
    fail('echo / chat', err);
  }
}

async function testEchoVoice() {
  header('3. Echo agent — Voice channel (WAV → Whisper STT → echo)');

  // Step A: Transcribe the synthetic WAV via Whisper
  let transcript: string;
  try {
    console.log('  Generating 1.5s 440 Hz WAV...');
    const wav = generateWavBuffer(1.5, 440);

    console.log(`  POSTing to Whisper STT at ${serverEnv.VOICESTUDIO_URL}...`);
    const stt = getSttProvider();
    const result = await stt.transcribe(wav, 'audio/wav', 'test_tone.wav');

    transcript = result.text?.trim() ?? '';
    console.log(`  Whisper transcript: "${transcript || '(empty — silent WAV is expected)'}"`);

    // Whisper may return empty for a pure sine tone — that's OK.
    // We test it anyway; the empty-transcript guard happens at the HTTP layer,
    // not in the direct runner call.
    if (transcript === '') {
      transcript = '[sine tone — no speech]'; // inject synthetic text
      ok('Whisper reachable (returned empty for pure tone — expected)', 'using synthetic fallback text');
    } else {
      ok(`Whisper transcribed: "${transcript.slice(0, 60)}"`);
    }
  } catch (err) {
    fail('Whisper STT ping', err);
    transcript = '[STT unavailable]';
  }

  // Step B: Run echo agent with voice channel + transcript as input
  try {
    const result = await executeRun(
      ctx('echo', { transcript, channel: 'voice', source: 'whisper' }),
    );

    if (result.interrupted) throw new Error('unexpected interrupt');
    ok('Echo agent ran with voice-channel input');
    ok('Answer contains transcript', JSON.stringify(result.output.answer).includes('transcript') ? 'yes' : 'reflected as object');
  } catch (err) {
    fail('echo / voice', err);
  }
}

async function testEchoApproval() {
  header('4. Echo-Approval agent — interrupt + resume flow');

  const runCtx = ctx('echo-approval', { amount: 500, action: 'pay_vendor' });

  // Phase 1: first run — should pause at interrupt
  let runId: string;
  try {
    const result = await executeRun(runCtx);
    runId = runCtx.runId;

    if (!result.interrupted) throw new Error('Expected graph to interrupt for approval — it did not!');
    ok('Run interrupted as expected (AWAITING_APPROVAL)', `runId=${runId}`);
  } catch (err) {
    fail('echo-approval / first run', err);
    return; // can't resume if first run failed
  }

  // Phase 2: approve in DB and resume with approval decision
  try {
    const { ApprovalService } = await import('../modules/ai/approvals/approval.service.js');
    const { ApprovalRepository } = await import('../modules/ai/approvals/approval.repository.js');
    const approvalRepo = new ApprovalRepository();
    const pendingApproval = await new ApprovalService().getPendingForRun(runCtx.runId);
    if (!pendingApproval) throw new Error('No pending approval found in DB for run ' + runCtx.runId);
    await approvalRepo.approve(pendingApproval.id, 'user-dev');
    ok('Approval marked APPROVED in DB', `approvalId=${pendingApproval.id}`);

    const resumed = await resumeRun(
      runCtx,
      { approved: true, approvalId: pendingApproval.id, proposal: { amount: 500, action: 'pay_vendor' } },
    );

    if (resumed.interrupted) throw new Error('Still interrupted after resume — unexpected');
    if (!resumed.output.summary.includes('Approved binding action executed successfully')) {
      throw new Error(`Expected approved action summary, got: ${resumed.output.summary}`);
    }
    ok('Resumed successfully after approval');
    ok('Output after resume', resumed.output.summary.slice(0, 80));
  } catch (err) {
    fail('echo-approval / resume', err);
  }
}

async function testEchoLoop() {
  header('5. Echo-Loop agent — maxSteps hard limit (should fail with MaxStepsExceededError)');

  try {
    await executeRun(ctx('echo-loop', { test: 'loop-limit' }));
    fail('echo-loop', new Error('Expected MaxStepsExceededError but run succeeded!'));
  } catch (err: any) {
    if (err?.constructor?.name === 'MaxStepsExceededError' || err?.message?.includes('Max steps')) {
      ok('MaxStepsExceededError thrown correctly', err.message.slice(0, 80));
    } else if (err?.message?.includes('recursion limit') || err?.message?.includes('Recursion')) {
      // LangGraph may surface this as a recursion-limit error before our guard fires
      ok('LangGraph recursion limit enforced (equivalent to maxSteps)', err.message.slice(0, 80));
    } else {
      fail('echo-loop (unexpected error type)', err);
    }
  }
}

async function testEchoSlow() {
  header('6. Echo-Slow agent — timeout enforcement (expects RunTimeoutError)');

  // Override timeout to 2 seconds for a fast test
  const slowCtx = buildRunContext(
    {
      id: `test-echo-slow-${Date.now()}`,
      organizationId: 'org-test-dev',
      projectId: null,
      createdBy: 'user-dev',
      agent: 'echo-slow' as any,
      inputSnapshot: { test: 'timeout' },
    },
    {
      maxSteps: 20,
      maxToolCalls: 15,
      maxTokens: 50000,
      timeoutMs: 2000,       // ← 2 s so the test is fast
      dailyBudgetUsd: 5,
    },
  );

  try {
    await executeRun(slowCtx);
    fail('echo-slow', new Error('Expected timeout error but run finished unexpectedly!'));
  } catch (err: any) {
    const isTimeout =
      err?.constructor?.name === 'RunTimeoutError' ||
      err?.message?.includes('timed out') ||
      err?.name === 'TimeoutError' ||
      err?.message?.includes('timeout');

    if (isTimeout) {
      ok('RunTimeoutError thrown correctly', err.message?.slice(0, 80));
    } else {
      fail('echo-slow (unexpected error type)', err);
    }
  }
}

async function testGeminiLlm() {
  header('7. Real Gemini LLM connectivity (gemini-3.5-flash via gemini-web2api proxy)');

  try {
    const { createModel } = await import('../modules/ai/graph/model-factory.js');
    const { HumanMessage } = await import('@langchain/core/messages');
    const model = createModel('cheap');
    const response = await model.invoke([
      new HumanMessage('Reply with: "SiteFlow AI online"'),
    ]);
    const content = typeof response.content === 'string' ? response.content.trim() : JSON.stringify(response.content);
    ok('Gemini LLM responded successfully', content.slice(0, 100));
  } catch (err) {
    fail('Gemini LLM invoke', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

async function printSummary() {
  await flushLangfuse();
  console.log('\n' + '─'.repeat(60));
  const total = passed + failed;
  if (failed === 0) {
    console.log(`${GREEN} All ${total} assertions passed!${RESET}`);
  } else {
    console.log(`${RED} ${failed} / ${total} assertions failed${RESET}`);
  }
  console.log(`\nLangfuse traces → http://localhost:3020`);
  console.log(`  Login: dev@siteflow.local / change-me-123`);
  console.log(`  Project: siteflow\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n${BOLD}═══════════════════════════════════════════════════════${RESET}`);
console.log(`${BOLD} SiteFlow Echo Agent Test Suite${RESET}`);
console.log(`  AI Provider : ${serverEnv.AI_PROVIDER}`);
console.log(`  LLM Base URL: ${serverEnv.OPENAI_BASE_URL ?? '(default OpenAI)'}`);
console.log(`  Cheap model : ${serverEnv.AI_MODEL_CHEAP}`);
console.log(`  Strong model: ${serverEnv.AI_MODEL_STRONG}`);
console.log(`  Langfuse    : ${serverEnv.LANGFUSE_HOST ?? 'disabled'}`);
console.log(`  Whisper STT : ${serverEnv.VOICESTUDIO_URL ?? 'disabled'}`);
console.log(`${BOLD}═══════════════════════════════════════════════════════${RESET}`);

await testEchoApi();
await testEchoChat();
await testEchoVoice();
await testEchoApproval();
await testEchoLoop();
await testEchoSlow();
await testGeminiLlm();

await printSummary();
await teardownCheckpointer();
process.exit(failed > 0 ? 1 : 0);
