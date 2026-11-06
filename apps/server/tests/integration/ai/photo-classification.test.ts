// apps/server/tests/integration/ai/photo-classification.test.ts
import { describe, it, expect } from 'vitest';
import { PhotoClassifierService } from '../../../src/modules/ai/vision/photo-classifier.service.js';

describe('Photo Classification Tests', () => {
  const classifier = new PhotoClassifierService();

  it.skip('should classify progress photo correctly', async () => {
    // Requires actual photo - skipped for now
    const fakeImageBase64 = 'fake-base64-data';
    const result = await classifier.analyzePhoto(fakeImageBase64);

    expect(result.category).toBeTruthy();
    expect(result.description).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('should generate field-log draft with NEVER auto-save', () => {
    const analysis = {
      category: 'PROGRESS' as const,
      description: 'Foundation work in progress on North wing',
      suggestedTags: ['foundation', 'north-wing', 'concrete'],
      confidence: 0.92,
    };

    const draft = classifier.generateFieldLogDraft(analysis, {
      location: 'North Wing - Foundation',
      timestamp: new Date('2024-01-15T10:30:00Z'),
      uploadedBy: 'John Doe',
    });

    expect(draft.requiresApproval).toBe(true); // CRITICAL: NEVER auto-save
    expect(draft.title).toContain('PROGRESS');
    expect(draft.description).toContain('Foundation work');
    expect(draft.tags).toEqual(['foundation', 'north-wing', 'concrete']);
  });

  it('should detect safety issues and flag for review', () => {
    const analysis = {
      category: 'SAFETY_ISSUE' as const,
      description: 'Worker without hard hat in active zone',
      suggestedTags: ['safety', 'ppe', 'violation'],
      confidence: 0.88,
      detectedIssues: [
        {
          type: 'SAFETY' as const,
          severity: 'HIGH' as const,
          description: 'Missing PPE - hard hat required',
        },
      ],
    };

    const draft = classifier.generateFieldLogDraft(analysis, {
      location: 'Active Construction Zone',
      timestamp: new Date(),
      uploadedBy: 'Safety Inspector',
    });

    expect(draft.category).toBe('SAFETY_ISSUE');
    expect(draft.requiresApproval).toBe(true);
  });

  it('should categorize material delivery photos', () => {
    const analysis = {
      category: 'MATERIAL_DELIVERY' as const,
      description: 'Steel beams delivered to site',
      suggestedTags: ['materials', 'steel', 'delivery'],
      confidence: 0.95,
    };

    const draft = classifier.generateFieldLogDraft(analysis, {
      location: 'Main Entrance',
      timestamp: new Date(),
      uploadedBy: 'Logistics Team',
    });

    expect(draft.category).toBe('MATERIAL_DELIVERY');
    expect(draft.tags).toContain('materials');
  });

  it('should categorize deficiency photos', () => {
    const analysis = {
      category: 'DEFICIENCY' as const,
      description: 'Crack in concrete slab',
      suggestedTags: ['deficiency', 'concrete', 'crack'],
      confidence: 0.90,
      detectedIssues: [
        {
          type: 'QUALITY' as const,
          severity: 'MEDIUM' as const,
          description: 'Concrete crack exceeds tolerance',
        },
      ],
    };

    const draft = classifier.generateFieldLogDraft(analysis, {
      location: 'Slab 2A',
      timestamp: new Date(),
      uploadedBy: 'QC Inspector',
    });

    expect(draft.category).toBe('DEFICIENCY');
    expect(draft.requiresApproval).toBe(true);
  });

  it('should categorize equipment photos', () => {
    const analysis = {
      category: 'EQUIPMENT' as const,
      description: 'Tower crane in operation',
      suggestedTags: ['equipment', 'crane', 'operations'],
      confidence: 0.93,
    };

    const draft = classifier.generateFieldLogDraft(analysis, {
      location: 'Site Central',
      timestamp: new Date(),
      uploadedBy: 'Equipment Manager',
    });

    expect(draft.category).toBe('EQUIPMENT');
    expect(draft.tags).toContain('equipment');
  });
});
