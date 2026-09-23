import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    worker: 'src/worker.ts',
  },
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  minify: false,
  // Do NOT bundle dependencies — Node.js must load them as separate modules
  // so OpenTelemetry's require-in-the-middle / import-in-the-middle can patch
  // them at startup. Bundling inlines the code and breaks all auto-instrumentation
  // (HTTP spans, pg spans, ioredis spans, Fastify spans).
  bundle: false,
});
