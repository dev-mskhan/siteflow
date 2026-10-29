// apps/server/tests/helpers/ai/test-audio.ts
// Generates a synthetic, valid 16kHz 16-bit mono PCM WAV buffer for STT tests.

export interface SyntheticWavOptions {
  sampleRate?: number;
  durationSec?: number;
  frequency?: number;
}

export function createSyntheticWavBuffer(options: SyntheticWavOptions = {}): Buffer {
  const sampleRate = options.sampleRate ?? 16000;
  const durationSec = options.durationSec ?? 1;
  const frequency = options.frequency ?? 440;

  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const dataSize = totalSamples * numChannels * bytesPerSample;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);

  // "fmt " sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // ByteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);             // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);

  // "data" sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write PCM sine wave samples
  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const angle = (2 * Math.PI * frequency * i) / sampleRate;
    const sample = Math.sin(angle) * 0x7fff * 0.5; // -0.5 to 0.5 volume
    buffer.writeInt16LE(Math.round(sample), offset);
    offset += 2;
  }

  return buffer;
}
