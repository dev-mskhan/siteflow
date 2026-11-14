import { eq } from 'drizzle-orm';
import { db } from '../../lib/db/index.js';
import { contactRequests, type NewContactRequest, type ContactRequest } from '@siteflow/database';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'contact-repository' });

export class ContactRepository {
  /**
   * Create a new contact request
   */
  async create(data: NewContactRequest): Promise<ContactRequest> {
    logger.info({ intent: data.intent, email: data.workEmail }, 'Creating contact request');
    
    const [request] = await db.insert(contactRequests).values(data).returning();
    
    if (!request) {
      throw new Error('Failed to create contact request');
    }
    
    logger.info({ id: request.id }, 'Contact request created successfully');
    return request;
  }

  /**
   * Find contact request by ID
   */
  async findById(id: string): Promise<ContactRequest | undefined> {
    const [request] = await db
      .select()
      .from(contactRequests)
      .where(eq(contactRequests.id, id))
      .limit(1);
    
    return request;
  }

  /**
   * Update contact request status
   */
  async updateStatus(
    id: string,
    status: ContactRequest['status'],
    notes?: string,
  ): Promise<ContactRequest> {
    const updateData: Partial<ContactRequest> = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'contacted' || status === 'qualified') {
      updateData.contactedAt = new Date();
    }

    if (notes) {
      updateData.internalNotes = notes;
    }

    const [updated] = await db
      .update(contactRequests)
      .set(updateData)
      .where(eq(contactRequests.id, id))
      .returning();

    if (!updated) {
      throw new Error('Contact request not found');
    }

    logger.info({ id, status }, 'Contact request status updated');
    return updated;
  }

  /**
   * Check if email has submitted within timeframe (spam protection)
   */
  async hasRecentSubmission(email: string, minutes: number = 15): Promise<boolean> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    
    const [recent] = await db
      .select({ id: contactRequests.id })
      .from(contactRequests)
      .where(eq(contactRequests.workEmail, email))
      .limit(1);

    return !!recent;
  }
}
