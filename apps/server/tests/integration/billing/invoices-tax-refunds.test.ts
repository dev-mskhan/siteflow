import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../../../src/lib/db/index.js';
import { createTestApp } from '../../helpers/test-app.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
}, 30_000);

afterAll(async () => {
  await app.close();
}, 30_000);

describe('SaaS invoice and payment-attempt persistence (10-08)', () => {
  it('provides separate PostgreSQL tables for SaaS invoices and payment attempts', async () => {
    const schemaRows = await getDb().execute(sql`
      SELECT
        to_regclass('app.saas_invoices')::text AS "invoiceTable",
        to_regclass('app.saas_payment_attempts')::text AS "paymentAttemptTable"
    `);

    expect(schemaRows[0]?.invoiceTable).toBe('app.saas_invoices');
    expect(schemaRows[0]?.paymentAttemptTable).toBe('app.saas_payment_attempts');
  });
});
