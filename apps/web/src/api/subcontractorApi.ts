/**
 * Re-export shim — pages import from ../../api/subcontractorApi.
 * Actual implementation lives in features/project/subcontractorApi.
 * 
 * NOTE: Mock API had org-level subcontractor CRUD which backend doesn't support.
 * Backend only supports PROJECT-scoped subcontractor assignment.
 * Org-level list/create/update removed (not implemented in backend).
 */
export * from '../features/project/subcontractorApi';
