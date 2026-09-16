import type { FastifyPluginAsync } from 'fastify';
import { createSuccessResponse } from '../../shared/response.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/',
    {
      schema: {
        description: 'Health check endpoint',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  status: { type: 'string' },
                  uptime: { type: 'number' },
                },
              },
              meta: {
                type: 'object',
                properties: {
                  timestamp: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.send(
        createSuccessResponse({
          status: 'ok',
          uptime: process.uptime(),
        }),
      );
    },
  );
};
