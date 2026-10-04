// apps/server/tests/helpers/test-app.ts
import { buildApp } from '../../src/app/index.js';
import type { FastifyInstance } from 'fastify';

/**
 * Creates and initialises a test Fastify instance.
 * Automatically handles app.ready() call.
 */
export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  const inject = app.inject.bind(app);
  let requestNumber = 0;

  app.inject = new Proxy(inject, {
    apply(target, thisArg, args) {
      const requestOptions = args[0];
      const thirdOctet = Math.floor(requestNumber / 254) % 256;
      const fourthOctet = (requestNumber % 254) + 1;
      requestNumber += 1;
      const remoteAddress = `198.51.${thirdOctet}.${fourthOctet}`;

      if (typeof requestOptions === 'string') {
        args[0] = { url: requestOptions, remoteAddress };
      } else if (requestOptions && typeof requestOptions === 'object') {
        args[0] = {
          ...requestOptions,
          remoteAddress:
            'remoteAddress' in requestOptions
              ? requestOptions.remoteAddress
              : remoteAddress,
        };
      }

      return Reflect.apply(target, thisArg, args);
    },
  });
  await app.ready();
  return app;
}
