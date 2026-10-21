// apps/server/src/modules/ai/voice/transcribe.worker.ts
// Background worker for async transcription jobs from object storage.

import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../../lib/queue/worker-factory.js';
import { AI_QUEUES } from '../ai.jobs.js';
import { getSttProvider } from './stt-factory.js';
import { guardInput } from '../guardrails/input-guard.js';
import { ConversationService } from '../conversations/conversation.service.js';

const logger = createLogger({ name: 'ai-transcribe-worker' });

export interface TranscribeJobPayload {
  organizationId: string;
  conversationId: string;
  userId: string;
  audioBase64?: string;
  mimeType: string;
  filename?: string;
}

export async function registerAiTranscribeWorker(boss: PgBoss): Promise<void> {
  const convService = new ConversationService();

  await registerWorker<TranscribeJobPayload>(
    boss,
    {
      queue: AI_QUEUES.TRANSCRIBE,
      concurrency: 3,
      timeoutSecs: 120,
      tenantIdExtractor: (data) => data.organizationId,
      tenantConcurrencyLimit: 2,
    },
    async (job) => {
      const { organizationId, conversationId, userId, audioBase64, mimeType, filename } = job.data;
      logger.info({ organizationId, conversationId }, 'Picked up async transcription job');

      if (!audioBase64) {
        throw new Error('audioBase64 data missing from transcription payload');
      }

      const buffer = Buffer.from(audioBase64, 'base64');
      const stt = getSttProvider();
      const result = await stt.transcribe(buffer, mimeType, filename);

      if (!result.text || result.text.trim().length === 0) {
        logger.warn({ conversationId }, 'Transcription yielded empty text');
        return;
      }

      guardInput(result.text, 'UNTRUSTED', { hardBlock: true });

      await convService.sendMessage({
        organizationId,
        conversationId,
        content: result.text,
        userId,
        channel: 'voice',
      });

      logger.info({ organizationId, conversationId }, 'Async transcription processed and dispatched');
    },
  );
}
