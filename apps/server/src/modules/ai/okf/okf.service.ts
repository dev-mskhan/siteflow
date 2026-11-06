// apps/server/src/modules/ai/okf/okf.service.ts
import { OkfRepository } from './okf.repository.js';
import type { NewOkfPage, OkfPage } from '@siteflow/database/schema';

export class OkfService {
  private repo: OkfRepository;

  constructor() {
    this.repo = new OkfRepository();
  }

  async createProposedPage(data: {
    organizationId: string;
    pagePath: string;
    title: string;
    content: string;
    source: 'AGENT_CORRECTION' | 'MANUAL' | 'IMPORTED';
    correctionContext?: any;
    createdBy: string;
  }): Promise<OkfPage> {
    const newPage: NewOkfPage = {
      organizationId: data.organizationId,
      pagePath: data.pagePath,
      title: data.title,
      content: data.content,
      status: 'DRAFT',
      version: 1,
      source: data.source,
      correctionContext: data.correctionContext,
      createdBy: data.createdBy,
    };

    return this.repo.create(newPage);
  }

  async listPages(
    organizationId: string,
    filters?: { status?: string; pagePath?: string }
  ): Promise<OkfPage[]> {
    return this.repo.list(organizationId, filters);
  }

  async getPage(pageId: string, organizationId: string): Promise<OkfPage | null> {
    return this.repo.getById(pageId, organizationId);
  }

  async approvePage(
    pageId: string,
    organizationId: string,
    approvedBy: string,
    approvalNotes?: string
  ): Promise<OkfPage> {
    return this.repo.approve(pageId, organizationId, approvedBy, approvalNotes);
  }

  async rejectPage(
    pageId: string,
    organizationId: string,
    approvedBy: string,
    approvalNotes?: string
  ): Promise<OkfPage> {
    return this.repo.reject(pageId, organizationId, approvedBy, approvalNotes);
  }

  async deletePage(pageId: string, organizationId: string): Promise<void> {
    await this.repo.delete(pageId, organizationId);
  }

  async getApprovedPages(organizationId: string): Promise<OkfPage[]> {
    return this.repo.list(organizationId, { status: 'APPROVED' });
  }
}
