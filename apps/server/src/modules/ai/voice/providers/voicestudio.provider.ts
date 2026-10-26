// apps/server/src/modules/ai/voice/providers/voicestudio.provider.ts
// VoiceStudio / Whisper STT provider using standard OpenAI-compatible audio API.

import type { SttProvider, TranscriptionResult } from '../stt-provider.js';

export interface VoiceStudioConfig {
  baseUrl: string;
  apiKey?: string;
  model?: string;
}

export class VoiceStudioProvider implements SttProvider {
  constructor(private readonly config: VoiceStudioConfig) {}

  async transcribe(
    buffer: Buffer,
    mimeType: string,
    filename = 'audio.webm',
  ): Promise<TranscriptionResult> {
    const endpoint = `${this.config.baseUrl.replace(/\/+$/, '')}/v1/audio/transcriptions`;

    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('model', this.config.model || 'whisper-1');
    formData.append('response_format', 'json');

    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`VoiceStudio transcription failed (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as {
      text?: string;
      language?: string;
      duration?: number;
    };

    return {
      text: data.text || '',
      language: data.language,
      durationSecs: data.duration,
      confidence: 1.0,
    };
  }
}
