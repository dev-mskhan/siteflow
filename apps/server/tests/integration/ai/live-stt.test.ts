// apps/server/tests/integration/ai/live-stt.test.ts
import { describe, it, expect } from 'vitest';
import { VoiceStudioProvider } from '../../../src/modules/ai/voice/providers/voicestudio.provider.js';
import { createSyntheticWavBuffer } from '../../helpers/ai/test-audio.js';
import { serverEnv } from '../../../src/config/env.js';

describe('Live STT Integration (VoiceStudio / Whisper Container)', () => {
  const provider = new VoiceStudioProvider({
    baseUrl: serverEnv.VOICESTUDIO_URL || 'http://localhost:3900',
    apiKey: serverEnv.VOICESTUDIO_API_KEY || 'whisper-95146ef999b41c291f0d656e149ebe5d9848e91167a9fbc3',
    model: 'whisper-1',
  });

  it(
    'transcribes a synthetic 1-second WAV buffer against live Whisper endpoint',
    async () => {
      const audioBuffer = createSyntheticWavBuffer({
        sampleRate: 16000,
        durationSec: 1,
        frequency: 440,
      });

      const result = await provider.transcribe(audioBuffer, 'audio/wav', 'test-sample.wav');

      expect(result).toBeDefined();
      expect(typeof result.text).toBe('string');
      expect(result.confidence).toBe(1.0);
      if (result.durationSecs !== undefined) {
        expect(result.durationSecs).toBeGreaterThanOrEqual(0);
      }
    },
    90000,
  );

  it(
    'fails with clear error message when server receives invalid audio data',
    async () => {
      const corruptedBuffer = Buffer.from('NOT_A_VALID_AUDIO_FILE_DATA');

      await expect(
        provider.transcribe(corruptedBuffer, 'audio/wav', 'corrupt.wav'),
      ).rejects.toThrow();
    },
    30000,
  );
});
