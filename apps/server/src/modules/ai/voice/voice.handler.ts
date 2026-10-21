// apps/server/src/modules/ai/voice/voice.handler.ts
// Handles audio upload, runs STT via configured provider, guards transcript, and enqueues conversation run.

import type { FastifyRequest, FastifyReply } from 'fastify';
import { serverEnv } from '../../../config/env.js';
import { getSttProvider } from './stt-factory.js';
import { guardInput } from '../guardrails/input-guard.js';
import { ConversationService } from '../conversations/conversation.service.js';
import { createSuccessResponse } from '../../../shared/response.js';

const ALLOWED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/x-m4a',
  'audio/m4a',
  'audio/aac',
]);

const conversationService = new ConversationService();

export async function handleVoiceMessage(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, conversationId } = request.params as {
    organizationId: string;
    conversationId: string;
  };
  const userId = request.user!.sub;

  let buffer: Buffer;
  let mimeType: string;
  let filename = 'voice_message.webm';

  if (request.isMultipart()) {
    const file = await request.file({
      limits: {
        fileSize: serverEnv.VOICE_MAX_FILE_BYTES,
        files: 1,
      },
    });

    if (!file) {
      return reply.status(400).send({ error: 'No audio file uploaded in multipart request' });
    }

    mimeType = file.mimetype;
    filename = file.filename || filename;
    buffer = await file.toBuffer();
  } else {
    // Direct raw audio body
    mimeType = request.headers['content-type'] || 'audio/webm';
    buffer = await request.body as Buffer;
  }

  if (!buffer || buffer.length === 0) {
    return reply.status(400).send({ error: 'Empty audio payload' });
  }

  if (buffer.length > serverEnv.VOICE_MAX_FILE_BYTES) {
    return reply.status(413).send({
      error: `Audio file exceeds maximum size of ${serverEnv.VOICE_MAX_FILE_BYTES} bytes`,
    });
  }

  const baseMime = mimeType.split(';')[0]?.trim().toLowerCase() || '';
  if (!ALLOWED_MIME_TYPES.has(baseMime)) {
    return reply.status(415).send({
      error: `Unsupported audio format '${baseMime}'. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`,
    });
  }

  // Transcribe via STT provider
  const stt = getSttProvider();
  const transcription = await stt.transcribe(buffer, mimeType, filename);

  if (!transcription.text || transcription.text.trim().length === 0) {
    return reply.status(422).send({ error: 'No intelligible speech detected in audio' });
  }

  // Guard transcript text (transcripts can be hard-blocked if prompt injection detected)
  guardInput(transcription.text, 'UNTRUSTED', { hardBlock: true });

  // Send message through conversation service with channel: 'voice'
  const { messageId, runId } = await conversationService.sendMessage({
    organizationId,
    conversationId,
    content: transcription.text,
    userId,
    channel: 'voice',
  });

  return reply.status(202).send(
    createSuccessResponse({
      messageId,
      runId,
      transcript: transcription.text,
      language: transcription.language,
      durationSecs: transcription.durationSecs,
    }),
  );
}
