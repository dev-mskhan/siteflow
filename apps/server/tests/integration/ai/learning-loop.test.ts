// apps/server/tests/integration/ai/learning-loop.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../../../src/lib/db/index.js';
import { OkfService } from '../../../src/modules/ai/okf/okf.service.js';
import { okfPages } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

describe('Learning Loop Integration Tests', () => {
  const okfService = new OkfService();
  const testOrgId1 = '11111111-1111-1111-1111-111111111111';
  const testOrgId2 = '22222222-2222-2222-2222-222222222222';
  const testUserId = '33333333-3333-3333-3333-333333333333';
  const db = getDb();

  afterAll(async () => {
    // Cleanup test data
    await db.delete(okfPages).where(eq(okfPages.organizationId, testOrgId1));
    await db.delete(okfPages).where(eq(okfPages.organizationId, testOrgId2));
  });

  it('should create proposed page in DRAFT status', async () => {
    const page = await okfService.createProposedPage({
      organizationId: testOrgId1,
      pagePath: 'test/learning-loop-1',
      title: 'Test Learning Loop',
      content: '# Test\nThis is a test correction.',
      source: 'AGENT_CORRECTION',
      correctionContext: {
        originalQuestion: 'What is the policy?',
        agentAnswer: 'Policy A',
        userCorrection: 'Actually, it is Policy B',
      },
      createdBy: testUserId,
    });

    expect(page.status).toBe('DRAFT');
    expect(page.pagePath).toBe('test/learning-loop-1');
    expect(page.organizationId).toBe(testOrgId1);
  });

  it('should NOT serve DRAFT pages via getApprovedPages', async () => {
    await okfService.createProposedPage({
      organizationId: testOrgId1,
      pagePath: 'test/draft-page',
      title: 'Draft Page',
      content: 'Should not be served',
      source: 'AGENT_CORRECTION',
      createdBy: testUserId,
    });

    const approved = await okfService.getApprovedPages(testOrgId1);
    const hasDraft = approved.some((p) => p.pagePath === 'test/draft-page');

    expect(hasDraft).toBe(false);
  });

  it('should approve page and change status to APPROVED', async () => {
    const draft = await okfService.createProposedPage({
      organizationId: testOrgId1,
      pagePath: 'test/to-approve',
      title: 'To Approve',
      content: 'Will be approved',
      source: 'AGENT_CORRECTION',
      createdBy: testUserId,
    });

    const approved = await okfService.approvePage(
      draft.id,
      testOrgId1,
      testUserId,
      'Looks good'
    );

    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe(testUserId);
    expect(approved.approvalNotes).toBe('Looks good');
  });

  it('should serve APPROVED pages via getApprovedPages', async () => {
    const draft = await okfService.createProposedPage({
      organizationId: testOrgId1,
      pagePath: 'test/approved-page',
      title: 'Approved Page',
      content: 'This should be served',
      source: 'AGENT_CORRECTION',
      createdBy: testUserId,
    });

    await okfService.approvePage(draft.id, testOrgId1, testUserId);

    const approved = await okfService.getApprovedPages(testOrgId1);
    const found = approved.find((p) => p.pagePath === 'test/approved-page');

    expect(found).toBeDefined();
    expect(found?.status).toBe('APPROVED');
  });

  it('should enforce org isolation - org1 cannot see org2 pages', async () => {
    await okfService.createProposedPage({
      organizationId: testOrgId2,
      pagePath: 'test/org2-page',
      title: 'Org 2 Page',
      content: 'Org 2 content',
      source: 'AGENT_CORRECTION',
      createdBy: testUserId,
    });

    const org1Pages = await okfService.listPages(testOrgId1);
    const hasOrg2Page = org1Pages.some((p) => p.pagePath === 'test/org2-page');

    expect(hasOrg2Page).toBe(false);
  });

  it('should reject page and change status to REJECTED', async () => {
    const draft = await okfService.createProposedPage({
      organizationId: testOrgId1,
      pagePath: 'test/to-reject',
      title: 'To Reject',
      content: 'Will be rejected',
      source: 'AGENT_CORRECTION',
      createdBy: testUserId,
    });

    const rejected = await okfService.rejectPage(
      draft.id,
      testOrgId1,
      testUserId,
      'Incorrect information'
    );

    expect(rejected.status).toBe('REJECTED');
    expect(rejected.approvalNotes).toBe('Incorrect information');
  });

  it('should enforce tenant isolation in multi-tenant queries', async () => {
    // Create pages in both orgs
    const org1Page = await okfService.createProposedPage({
      organizationId: testOrgId1,
      pagePath: 'test/tenant-1',
      title: 'Tenant 1',
      content: 'Tenant 1 content',
      source: 'AGENT_CORRECTION',
      createdBy: testUserId,
    });

    const org2Page = await okfService.createProposedPage({
      organizationId: testOrgId2,
      pagePath: 'test/tenant-2',
      title: 'Tenant 2',
      content: 'Tenant 2 content',
      source: 'AGENT_CORRECTION',
      createdBy: testUserId,
    });

    // Approve both
    await okfService.approvePage(org1Page.id, testOrgId1, testUserId);
    await okfService.approvePage(org2Page.id, testOrgId2, testUserId);

    // Verify isolation
    const org1Approved = await okfService.getApprovedPages(testOrgId1);
    const org2Approved = await okfService.getApprovedPages(testOrgId2);

    expect(org1Approved.every((p) => p.organizationId === testOrgId1)).toBe(true);
    expect(org2Approved.every((p) => p.organizationId === testOrgId2)).toBe(true);
  });
});
