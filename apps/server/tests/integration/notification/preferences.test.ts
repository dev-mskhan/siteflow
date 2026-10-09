import { describe, it, expect } from 'vitest';
import { preferenceService } from '../../../src/modules/notification/preferences/preference.service.js';

describe('F.9 Persisted Notification Preferences Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const org2Id = `org2_${runId}`;
  const user1Id = `usr1_${runId}`;
  const user2Id = `usr2_${runId}`;

  it('evaluates channel as enabled by default when no explicit override exists', async () => {
    const isEnabled = await preferenceService.isChannelEnabled(org1Id, user1Id, 'TaskCompleted', 'EMAIL');
    expect(isEnabled).toBe(true);
  });

  it('persists preference override and reflects disabled channel evaluation', async () => {
    await preferenceService.setPreference(org1Id, user1Id, 'TaskCompleted', 'EMAIL', false);

    const isEnabled = await preferenceService.isChannelEnabled(org1Id, user1Id, 'TaskCompleted', 'EMAIL');
    expect(isEnabled).toBe(false);

    // Other event types remain enabled by default
    const issueEnabled = await preferenceService.isChannelEnabled(org1Id, user1Id, 'IssueCreated', 'EMAIL');
    expect(issueEnabled).toBe(true);
  });

  it('enforces multi-tenant isolation on user preferences', async () => {
    await preferenceService.setPreference(org1Id, user1Id, 'TaskCompleted', 'EMAIL', false);
    await preferenceService.setPreference(org2Id, user2Id, 'TaskCompleted', 'EMAIL', true);

    const user1Prefs = await preferenceService.getUserPreferences(org1Id, user1Id);
    const user2Prefs = await preferenceService.getUserPreferences(org2Id, user2Id);

    expect(user1Prefs.length).toBe(1);
    expect(user1Prefs[0].enabled).toBe(false);

    expect(user2Prefs.length).toBe(1);
    expect(user2Prefs[0].enabled).toBe(true);

    // Cross-tenant lookup returns empty
    const crossTenant = await preferenceService.getUserPreferences(org2Id, user1Id);
    expect(crossTenant.length).toBe(0);
  });

  it('rejects preference updates missing tenant or user context', async () => {
    await expect(preferenceService.setPreference('', user1Id, 'TaskCompleted', 'EMAIL', false)).rejects.toThrow('organizationId and userId are required');
    await expect(preferenceService.setPreference(org1Id, '', 'TaskCompleted', 'EMAIL', false)).rejects.toThrow('organizationId and userId are required');
  });
});
