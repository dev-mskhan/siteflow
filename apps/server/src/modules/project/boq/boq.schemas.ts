export {
  createBoqSchema,
  reviseBoqSchema,
  boqImportPreviewSchema,
  boqImportCommitSchema,
  boqTransitionSchema,
  boqItemMappingSchema,
  boqParamsSchema,
  boqListQuerySchema,
  boqRevisionListQuerySchema,
  boqExportQuerySchema,
} from '@siteflow/shared';
export type {
  CreateBoqInput,
  ReviseBoqInput,
  BoqImportPreviewInput,
  BoqImportCommitInput,
  BoqTransitionInput,
  BoqItemMappingInput,
} from '@siteflow/shared';

const boqParams = {
  type: 'object',
  required: ['organizationId', 'projectId'],
  properties: {
    organizationId: { type: 'string' },
    projectId: { type: 'string' },
    boqId: { type: 'string' },
    revisionId: { type: 'string' },
    itemId: { type: 'string' },
  },
} as const;

const base = {
  tags: ['boqs'] as string[],
  security: [{ bearerAuth: [] as string[] }],
  params: boqParams,
};

export const boqRouteDocs = {
  create: { ...base, summary: 'Create a new Bill of Quantities (BOQ)' },
  list: { ...base, summary: 'List Bill of Quantities for a project' },
  get: { ...base, summary: 'Get a specific BOQ by ID' },
  revise: { ...base, summary: 'Create a new BOQ revision' },
  listRevisions: { ...base, summary: 'List revisions of a BOQ' },
  getRevision: { ...base, summary: 'Get a specific BOQ revision' },
  previewImport: { ...base, summary: 'Preview BOQ CSV/spreadsheet import' },
  commitImport: { ...base, summary: 'Commit BOQ CSV/spreadsheet import' },
  submit: { ...base, summary: 'Submit BOQ for review/approval' },
  approve: { ...base, summary: 'Approve a BOQ revision' },
  lock: { ...base, summary: 'Lock a BOQ revision against further edits' },
  mapItem: { ...base, summary: 'Map a BOQ item to cost codes or phase' },
  exportCsv: { ...base, summary: 'Export BOQ items to CSV' },
} as const;
