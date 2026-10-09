// apps/web/src/reporting/report-api.ts
// F.16 — Typed API client for report endpoints.

export interface ReportFilter {
  datePreset?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportEnvelope {
  reportType: string;
  organizationId: string;
  projectId?: string | null;
  asOf: string;
  effectiveTimezone: string;
  filters: ReportFilter;
  coverage: { isAvailable: boolean; sourceModule: string; reason?: string | null };
  data: Record<string, unknown>;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: { code: string; message: string };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

const BASE = '/api/v1';

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`HTTP ${res.status}: ${body?.error?.message ?? res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function getHealthReport(orgId: string, projectId: string, token: string) {
  return get<ApiSuccess<ReportEnvelope>>(
    `${BASE}/organizations/${orgId}/projects/${projectId}/reports/health`,
    token,
  );
}

export function getScheduleReport(orgId: string, projectId: string, token: string, filter?: ReportFilter) {
  const qs = filter?.datePreset ? `?datePreset=${filter.datePreset}` : '';
  return get<ApiSuccess<ReportEnvelope>>(
    `${BASE}/organizations/${orgId}/projects/${projectId}/reports/schedule${qs}`,
    token,
  );
}

export function getCostReport(orgId: string, projectId: string, token: string) {
  return get<ApiSuccess<ReportEnvelope>>(
    `${BASE}/organizations/${orgId}/projects/${projectId}/reports/cost`,
    token,
  );
}

export function getProcurementReport(orgId: string, projectId: string, token: string) {
  return get<ApiSuccess<ReportEnvelope>>(
    `${BASE}/organizations/${orgId}/projects/${projectId}/reports/procurement`,
    token,
  );
}

export function getSubcontractorReport(orgId: string, projectId: string, token: string) {
  return get<ApiSuccess<ReportEnvelope>>(
    `${BASE}/organizations/${orgId}/projects/${projectId}/reports/subcontractor`,
    token,
  );
}

export function getExecutiveSummaryReport(orgId: string, projectId: string, token: string) {
  return get<ApiSuccess<ReportEnvelope>>(
    `${BASE}/organizations/${orgId}/projects/${projectId}/reports/executive-summary`,
    token,
  );
}

export function getPortfolioReport(orgId: string, token: string) {
  return get<ApiSuccess<ReportEnvelope>>(
    `${BASE}/organizations/${orgId}/reports/portfolio`,
    token,
  );
}

// CSV export
export function requestCsvExport(
  orgId: string,
  projectId: string | null,
  reportType: string,
  filter: ReportFilter,
  token: string,
) {
  return fetch(`${BASE}/organizations/${orgId}/exports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId, reportType, format: 'csv', filter }),
  }).then((r) => r.json());
}

export function getExportStatus(orgId: string, exportId: string, token: string) {
  return get<ApiSuccess<{ id: string; status: string; downloadUrl?: string }>>(
    `${BASE}/organizations/${orgId}/exports/${exportId}`,
    token,
  );
}
