// apps/server/src/modules/ai/voice/stt-factory.ts
// Factory for obtaining the active STT provider based on server configuration.

import { serverEnv } from '../../../config/env.js';
import type { SttProvider } from './stt-provider.js';
import { FakeSttProvider } from './providers/fake-stt.provider.js';
import { VoiceStudioProvider } from './providers/voicestudio.provider.js';

let cachedProvider: SttProvider | null = null;

export function getSttProvider(): SttProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  // In test/fake mode or when VoiceStudio is not configured, fallback to fake
  if (serverEnv.AI_PROVIDER === 'fake' || !serverEnv.VOICESTUDIO_URL) {
    cachedProvider = new FakeSttProvider();
    return cachedProvider;
  }

  cachedProvider = new VoiceStudioProvider({
    baseUrl: serverEnv.VOICESTUDIO_URL,
    apiKey: serverEnv.VOICESTUDIO_API_KEY,
    model: serverEnv.VOICE_MODEL,
  });

  return cachedProvider;
}

export function resetSttProvider(): void {
  cachedProvider = null;
}

export function setSttProvider(provider: SttProvider | null): void {
  cachedProvider = provider;
}
