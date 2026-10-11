import { and, eq } from 'drizzle-orm';
import type { DatabaseTransaction } from '@siteflow/database';
import { saasCustomers, type SaasCustomer } from '@siteflow/database/schema';
import { getDb } from '../../lib/db/index.js';
import { generateId } from '../../lib/id.js';

export type StripeMode = 'test' | 'live';

export class CustomerRepository {
  private get db() {
    return getDb();
  }

  async findByOrganization(
    organizationId: string,
    stripeMode: StripeMode,
    tx?: DatabaseTransaction | ReturnType<typeof getDb>,
  ): Promise<SaasCustomer | undefined> {
    const db = tx ?? this.db;
    const rows = await db
      .select()
      .from(saasCustomers)
      .where(
        and(
          eq(saasCustomers.organizationId, organizationId),
          eq(saasCustomers.stripeMode, stripeMode),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async createOrGet(
    organizationId: string,
    stripeMode: StripeMode,
    stripeCustomerId: string,
    tx?: DatabaseTransaction | ReturnType<typeof getDb>,
  ): Promise<SaasCustomer> {
    const db = tx ?? this.db;
    await db
      .insert(saasCustomers)
      .values({
        id: generateId(),
        organizationId,
        stripeMode,
        stripeCustomerId,
      })
      .onConflictDoNothing();

    const existing = await this.findByOrganization(organizationId, stripeMode, tx);
    if (!existing) {
      throw new Error('Stripe customer association could not be persisted for this organization');
    }
    return existing;
  }
}

export const customerRepository = new CustomerRepository();
