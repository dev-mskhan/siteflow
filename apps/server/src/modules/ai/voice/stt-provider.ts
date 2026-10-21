// apps/server/src/modules/ai/voice/stt-provider.ts
// Speech-to-text abstraction interface.
// Allows swapping between VoiceStudio (Whisper), Cloud APIs, and Fake (for tests).

export interface TranscriptionResult {
  text: string;
  language?: string;
  confidence?: number;
  durationSecs?: number;
}

export interface SttProvider {
  transcribe(buffer: Buffer, mimeType: string, filename?: string): Promise<TranscriptionResult>;
}
