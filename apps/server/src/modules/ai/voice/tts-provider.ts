// apps/server/src/modules/ai/voice/tts-provider.ts
//
// Text-to-Speech (TTS) provider interface.
//
// STATUS: NOT IMPLEMENTED
//
// TTS converts agent text responses back to audio for voice-first interfaces.
// STT (speech-to-text) is fully implemented via VoiceStudioProvider.
//
// To implement TTS, add a provider class that implements TtsProvider and wire
// it into voice.routes.ts with a new POST /voice/synthesize endpoint.
//
// Candidate providers:
//   - ElevenLabs API (high quality, streaming)
//   - OpenAI TTS API (tts-1, tts-1-hd)
//   - ScribeCrate / VoiceStudio (if it supports TTS as well as STT)
//   - Edge TTS (free, lower quality)

export interface TtsSynthesisResult {
  /** Audio buffer in the requested format */
  audio: Buffer;
  /** MIME type of the audio (e.g. audio/mpeg, audio/wav) */
  mimeType: string;
  /** Duration of the synthesised audio in seconds */
  durationSecs: number;
  /** Voice/model used */
  voice: string;
}

export interface TtsProvider {
  /**
   * Convert text to speech audio.
   *
   * @param text    - Text to synthesize (max 5000 chars typically)
   * @param voice   - Voice identifier (provider-specific)
   * @param format  - Output audio format ('mp3' | 'wav' | 'ogg')
   */
  synthesize(text: string, voice?: string, format?: 'mp3' | 'wav' | 'ogg'): Promise<TtsSynthesisResult>;
}

/**
 * Placeholder TTS provider that throws a clear NOT_IMPLEMENTED error.
 * Replace with a real provider implementation when TTS is prioritised.
 */
export class NotImplementedTtsProvider implements TtsProvider {
  async synthesize(_text: string, _voice?: string, _format?: 'mp3' | 'wav' | 'ogg'): Promise<TtsSynthesisResult> {
    throw new Error(
      'TTS_NOT_IMPLEMENTED: Text-to-speech is not yet available. ' +
      'To enable TTS, implement a TtsProvider (ElevenLabs, OpenAI TTS, or VoiceStudio) ' +
      'and register it in voice.routes.ts.',
    );
  }
}
