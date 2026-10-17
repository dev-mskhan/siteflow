import type { FieldLogDTO, FieldLogAmendmentDTO } from '../types/fieldLogTypes';

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

export const MOCK_FIELD_LOGS: Record<string, FieldLogDTO[]> = {
  proj_01: [
    {
      id: 'log_01',
      organizationId: 'org_01',
      projectId: 'proj_01',
      logDate: today,
      supervisorId: 'usr_01',
      status: 'DRAFT',
      notes: 'Started pile driving section B. Weather clear.',
      lockedAt: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'log_02',
      organizationId: 'org_01',
      projectId: 'proj_01',
      logDate: yesterday,
      supervisorId: 'usr_01',
      status: 'SUBMITTED',
      notes: 'Foundation excavation complete. Awaiting inspection.',
      lockedAt: null,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'log_03',
      organizationId: 'org_01',
      projectId: 'proj_01',
      logDate: dayBefore,
      supervisorId: 'usr_02',
      status: 'LOCKED',
      notes: 'All ground slab formwork in place. Ready for concrete.',
      lockedAt: new Date(Date.now() - 43200000).toISOString(),
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ],
};

export const MOCK_FIELD_LOG_ENTRIES = {
  log_01: [
    {
      id: 'entry_01_1',
      logId: 'log_01',
      taskId: 'task_01_2',
      completionPctRecorded: 35,
      quantityCompleted: '12',
      unit: 'piles',
      notes: 'Section B piles 1-12 driven to depth',
    },
  ],
  log_02: [
    {
      id: 'entry_02_1',
      logId: 'log_02',
      taskId: 'task_01_1',
      completionPctRecorded: 80,
      quantityCompleted: '450',
      unit: 'm³',
      notes: 'Excavation complete, leveling in progress',
    },
    {
      id: 'entry_02_2',
      logId: 'log_02',
      taskId: 'task_01_2',
      completionPctRecorded: 20,
      quantityCompleted: null,
      unit: null,
      notes: 'Pile rig mobilized',
    },
  ],
  log_03: [
    {
      id: 'entry_03_1',
      logId: 'log_03',
      taskId: 'task_01_1',
      completionPctRecorded: 100,
      quantityCompleted: '500',
      unit: 'm³',
      notes: 'Foundation complete',
    },
    {
      id: 'entry_03_2',
      logId: 'log_03',
      taskId: 'task_01_3',
      completionPctRecorded: 60,
      quantityCompleted: '280',
      unit: 'm²',
      notes: 'Formwork placed, rebar installed',
    },
    {
      id: 'entry_03_3',
      logId: 'log_03',
      taskId: 'task_01_2',
      completionPctRecorded: 100,
      quantityCompleted: '48',
      unit: 'piles',
      notes: 'All piles driven and tested',
    },
  ],
};

export const MOCK_FIELD_LOG_AMENDMENTS: Record<string, FieldLogAmendmentDTO[]> = {
  log_03: [
    {
      id: 'amendment_01',
      logId: 'log_03',
      organizationId: 'org_01',
      projectId: 'proj_01',
      requestedBy: 'usr_01',
      approvedBy: 'usr_02',
      approvedAt: new Date(Date.now() - 3600000).toISOString(),
      reason: 'Quantity recorded incorrectly - actual piles driven was 48, not 52 as initially reported',
      correction: {
        entryId: 'entry_03_3',
        field: 'quantityCompleted',
        oldValue: '52',
        newValue: '48',
      },
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
  ],
};
