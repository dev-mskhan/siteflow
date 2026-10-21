// apps/server/src/modules/ai/voice/providers/fake-stt.provider.ts
// Deterministic fake STT provider for unit and integration testing.

import type { SttProvider, TranscriptionResult } from '../stt-provider.js';

export class FakeSttProvider implements SttProvider {
  constructor(private readonly defaultText: string = 'fake transcribed speech') {}

  async transcribe(_buffer: Buffer, _mimeType: string, _filename?: string): Promise<TranscriptionResult> {
    return {
      text: this.defaultText,
      language: 'en',
      confidence: 1.0,
      durationSecs: 3.5,
    };
  }
}
