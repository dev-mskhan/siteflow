// apps/server/src/modules/ai/agents/coordinator/evals/evaluate-coordinator.ts
//
// Coordinator Agent Evaluation Script
// Measures routing accuracy against ground truth dataset
//
// Usage:
//   pnpm tsx apps/server/src/modules/ai/agents/coordinator/evals/evaluate-coordinator.ts
//
// Requires:
//   - Valid .env with database connection
//   - Valid AI provider credentials
//   - Test organization and project IDs

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRunService } from '../../../runs/agent-run.service.js';
import type { CoordinatorOutput } from '../output.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Types ─────────────────────────────────────────────────────────────────────

interface TestCase {
  id: number;
  question: string;
  expected_agent: string;
  category: string;
  difficulty: string;
  keywords: string[];
}

interface EvaluationDataset {
  version: string;
  description: string;
  target_accuracy: number;
  created: string;
  test_cases: TestCase[];
  statistics: {
    total: number;
    by_agent: Record<string, number>;
    by_difficulty: Record<string, number>;
  };
}

interface EvaluationResult {
  testCaseId: number;
  question: string;
  expectedAgent: string;
  actualAgent: string;
  isCorrect: boolean;
  runId: string;
  status: string;
  difficulty: string;
  category: string;
  errorMessage?: string;
  responseTime: number; // milliseconds
}

interface EvaluationSummary {
  timestamp: string;
  totalCases: number;
  correctRoutings: number;
  incorrectRoutings: number;
  failedRuns: number;
  accuracy: number;
  targetAccuracy: number;
  passed: boolean;
  byDifficulty: Record<string, { correct: number; total: number; accuracy: number }>;
  byAgent: Record<string, { correct: number; total: number; accuracy: number }>;
  averageResponseTime: number;
  results: EvaluationResult[];
}

// ── Configuration ─────────────────────────────────────────────────────────────

const CONFIG = {
  // Update these with your test environment values
  organizationId: process.env.TEST_ORG_ID || 'org_test',
  projectId: process.env.TEST_PROJECT_ID || 'proj_test',
  userId: process.env.TEST_USER_ID || 'user_test',
  
  // Dataset path (relative to workspace root)
  datasetPath: path.resolve(__dirname, '../../../../../../.planning/coordinator-evaluation-dataset.json'),
  
  // Output path for results
  outputPath: path.resolve(__dirname, './evaluation-results.json'),
  
  // Evaluation settings
  delayBetweenRequests: 1000, // ms between requests (rate limiting)
  maxRetries: 2, // retry failed requests
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🤖 Coordinator Agent Evaluation');
  console.log('================================\n');

  // Load dataset
  console.log('📂 Loading evaluation dataset...');
  const datasetRaw = await fs.readFile(CONFIG.datasetPath, 'utf-8');
  const dataset: EvaluationDataset = JSON.parse(datasetRaw);
  
  console.log(`✅ Loaded ${dataset.test_cases.length} test cases`);
  console.log(`📊 Target accuracy: ${(dataset.target_accuracy * 100).toFixed(1)}%`);
  console.log(`🎯 By agent: ${JSON.stringify(dataset.statistics.by_agent, null, 2)}`);
  console.log(`🎯 By difficulty: ${JSON.stringify(dataset.statistics.by_difficulty, null, 2)}\n`);

  // Initialize services
  const runService = new AgentRunService();
  const results: EvaluationResult[] = [];
  
  // Run evaluation
  console.log('🚀 Starting evaluation...\n');
  
  let completed = 0;
  const startTime = Date.now();
  
  for (const testCase of dataset.test_cases) {
    const testStart = Date.now();
    
    try {
      console.log(`[${completed + 1}/${dataset.test_cases.length}] Testing: "${testCase.question.substring(0, 60)}..."`);
      
      // Create coordinator run
      const { runId } = await runService.startRun({
        organizationId: CONFIG.organizationId,
        projectId: CONFIG.projectId,
        agent: 'coordinator',
        trigger: 'API',
        channel: 'api',
        input: { question: testCase.question },
        createdBy: CONFIG.userId,
      });

      // Wait for completion
      const run = await waitForRunCompletion(runService, runId, CONFIG.organizationId);
      const responseTime = Date.now() - testStart;
      
      if (run.status === 'SUCCEEDED' && run.outputSnapshot) {
        const output = run.outputSnapshot as CoordinatorOutput;
        const actualAgent = output.routedTo.agent;
        const isCorrect = actualAgent === testCase.expected_agent;
        
        results.push({
          testCaseId: testCase.id,
          question: testCase.question,
          expectedAgent: testCase.expected_agent,
          actualAgent,
          isCorrect,
          runId,
          status: run.status,
          difficulty: testCase.difficulty,
          category: testCase.category,
          responseTime,
        });
        
        console.log(`   ${isCorrect ? '✅' : '❌'} Expected: ${testCase.expected_agent}, Got: ${actualAgent} (${responseTime}ms)`);
      } else {
        // Run failed
        results.push({
          testCaseId: testCase.id,
          question: testCase.question,
          expectedAgent: testCase.expected_agent,
          actualAgent: 'FAILED',
          isCorrect: false,
          runId,
          status: run.status,
          difficulty: testCase.difficulty,
          category: testCase.category,
          errorMessage: run.errorMessage ?? 'Unknown error',
          responseTime,
        });
        
        console.log(`   ❌ Run failed: ${run.errorMessage ?? 'Unknown error'}`);
      }
      
      completed++;
      
      // Rate limiting delay
      if (completed < dataset.test_cases.length) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenRequests));
      }
      
    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      
      results.push({
        testCaseId: testCase.id,
        question: testCase.question,
        expectedAgent: testCase.expected_agent,
        actualAgent: 'ERROR',
        isCorrect: false,
        runId: 'none',
        status: 'FAILED',
        difficulty: testCase.difficulty,
        category: testCase.category,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - testStart,
      });
      
      completed++;
    }
  }
  
  const totalTime = Date.now() - startTime;
  
  // Calculate summary statistics
  console.log('\n📊 Computing statistics...\n');
  
  const summary = computeSummary(results, dataset.target_accuracy, totalTime);
  
  // Print summary
  printSummary(summary);
  
  // Save results
  await fs.writeFile(CONFIG.outputPath, JSON.stringify(summary, null, 2));
  console.log(`\n💾 Results saved to: ${CONFIG.outputPath}`);
  
  // Exit with appropriate code
  process.exit(summary.passed ? 0 : 1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForRunCompletion(
  runService: AgentRunService,
  runId: string,
  organizationId: string,
  timeoutMs = 120000, // 2 minutes
  pollIntervalMs = 2000,
) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const run = await runService.getRun(runId, organizationId);
    
    if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      return run;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  throw new Error(`Run timeout after ${timeoutMs}ms`);
}

function computeSummary(
  results: EvaluationResult[],
  targetAccuracy: number,
  totalTimeMs: number,
): EvaluationSummary {
  const correctRoutings = results.filter(r => r.isCorrect).length;
  const incorrectRoutings = results.filter(r => !r.isCorrect && r.status === 'SUCCEEDED').length;
  const failedRuns = results.filter(r => r.status !== 'SUCCEEDED').length;
  const accuracy = correctRoutings / results.length;
  
  // By difficulty
  const byDifficulty: Record<string, { correct: number; total: number; accuracy: number }> = {};
  for (const result of results) {
    if (!byDifficulty[result.difficulty]) {
      byDifficulty[result.difficulty] = { correct: 0, total: 0, accuracy: 0 };
    }
    byDifficulty[result.difficulty].total++;
    if (result.isCorrect) {
      byDifficulty[result.difficulty].correct++;
    }
  }
  for (const difficulty in byDifficulty) {
    byDifficulty[difficulty].accuracy = byDifficulty[difficulty].correct / byDifficulty[difficulty].total;
  }
  
  // By agent
  const byAgent: Record<string, { correct: number; total: number; accuracy: number }> = {};
  for (const result of results) {
    const agent = result.expectedAgent;
    if (!byAgent[agent]) {
      byAgent[agent] = { correct: 0, total: 0, accuracy: 0 };
    }
    byAgent[agent].total++;
    if (result.isCorrect) {
      byAgent[agent].correct++;
    }
  }
  for (const agent in byAgent) {
    byAgent[agent].accuracy = byAgent[agent].correct / byAgent[agent].total;
  }
  
  // Average response time
  const totalResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0);
  const averageResponseTime = totalResponseTime / results.length;
  
  return {
    timestamp: new Date().toISOString(),
    totalCases: results.length,
    correctRoutings,
    incorrectRoutings,
    failedRuns,
    accuracy,
    targetAccuracy,
    passed: accuracy >= targetAccuracy,
    byDifficulty,
    byAgent,
    averageResponseTime,
    results,
  };
}

function printSummary(summary: EvaluationSummary) {
  console.log('════════════════════════════════════════════════════════');
  console.log('                  EVALUATION SUMMARY                    ');
  console.log('════════════════════════════════════════════════════════\n');
  
  console.log(`📅 Timestamp: ${summary.timestamp}`);
  console.log(`📊 Total test cases: ${summary.totalCases}`);
  console.log(`✅ Correct routings: ${summary.correctRoutings}`);
  console.log(`❌ Incorrect routings: ${summary.incorrectRoutings}`);
  console.log(`💥 Failed runs: ${summary.failedRuns}`);
  console.log(`🎯 Accuracy: ${(summary.accuracy * 100).toFixed(2)}%`);
  console.log(`🎯 Target: ${(summary.targetAccuracy * 100).toFixed(2)}%`);
  console.log(`⏱️  Average response time: ${summary.averageResponseTime.toFixed(0)}ms`);
  console.log(`\n${summary.passed ? '✅ PASSED' : '❌ FAILED'}`);
  
  console.log('\n📊 By Difficulty:');
  for (const [difficulty, stats] of Object.entries(summary.byDifficulty)) {
    console.log(`   ${difficulty.padEnd(8)}: ${stats.correct}/${stats.total} (${(stats.accuracy * 100).toFixed(1)}%)`);
  }
  
  console.log('\n📊 By Agent:');
  for (const [agent, stats] of Object.entries(summary.byAgent)) {
    console.log(`   ${agent.padEnd(20)}: ${stats.correct}/${stats.total} (${(stats.accuracy * 100).toFixed(1)}%)`);
  }
  
  // Show misclassified examples
  const misclassified = summary.results.filter(r => !r.isCorrect && r.status === 'SUCCEEDED');
  if (misclassified.length > 0) {
    console.log('\n❌ Misclassified Examples:');
    for (const result of misclassified.slice(0, 5)) { // Show first 5
      console.log(`   Q: "${result.question.substring(0, 60)}..."`);
      console.log(`   Expected: ${result.expectedAgent}, Got: ${result.actualAgent}\n`);
    }
  }
  
  console.log('\n════════════════════════════════════════════════════════\n');
}

// ── Run ───────────────────────────────────────────────────────────────────────

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
