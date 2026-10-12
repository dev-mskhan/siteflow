// apps/server/tests/integration/platform-routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import {
  createVerifiedUser,
  createOrgWithAdmin,
} from '../helpers/fixtures.js';

describe('Platform read routes (11-02) — route-level authorization', () => {
  let app: FastifyInstance;
  let orgOwnerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser();
    orgOwnerToken = owner.token;
    await createOrgWithAdmin(app, orgOwnerToken, 'Platform Route Org');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated organization listing with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/organizations',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects unauthenticated account listing with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/accounts',
    });
    expect(res.statusCode).toBe(401);
  });

  it('denies an organization owner (no platform role) with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/organizations',
      headers: { authorization: `Bearer ${orgOwnerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('denies an organization owner from account listing with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/platform/accounts',
      headers: { authorization: `Bearer ${orgOwnerToken}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
