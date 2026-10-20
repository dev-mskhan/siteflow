/**
 * reportTypes — Group 12 read-only report response shapes.
 * Sources: apps/server/src/modules/reporting/docs/report.api.schemas.ts
 */

export type HealthColor = 'GREEN' | 'AMBER' | 'RED' | 'UNKNOWN';

export interface TaskStats {
  total: number;
  notStarted?: number;
  inProgress: number;
  completed: number;
  blocked?: number;
  overdue: number;
  cancelled?: number;
  criticalPath?: number;
}

// ── Portfolio ─────────────────────────────────────────────────────────────────
export interface PortfolioProjectSummary {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  scheduleHealth: HealthColor;
  budgetHealth: HealthColor;
  overallHealth: HealthColor;
  taskStats: TaskStats;
  openIssues: number;
  openRFIs: number;
}

export interface PortfolioReportDTO {
  generatedAt: string;
  projects: PortfolioProjectSummary[];
}

// ── Health ────────────────────────────────────────────────────────────────────
export interface HealthReportDTO {
  generatedAt: string;
  scheduleHealth: HealthColor;
  budgetHealth: HealthColor;
  taskStats: TaskStats;
  openIssues: number;
  openRFIs: number;
  criticalRFIs: number;
  openSafetyEvents: number;
}

// ── Schedule ──────────────────────────────────────────────────────────────────
export interface ScheduleMilestone {
  id: string;
  name: string;
  plannedDate: string | null;
  currentDate: string | null;
  status: string;
  varianceDays: number | null;
}

export interface ScheduleReportDTO {
  generatedAt: string;
  baselineComparison: {
    baselineId: string | null;
    baselineName: string | null;
    plannedStartDate: string | null;
    plannedEndDate: string | null;
    currentStartDate: string | null;
    currentEndDate: string | null;
    startVarianceDays: number | null;
    endVarianceDays: number | null;
  };
  schedulePerformanceIndex: number | null;
  taskStats: TaskStats;
  milestones: ScheduleMilestone[];
}

// ── Cost ──────────────────────────────────────────────────────────────────────
export interface CostReportCurrency {
  currencyCode: string;
  originalBudget: string;
  approvedBudgetChanges: string;
  revisedBudget: string;
  committed: string;
  postedActual: string;
  forecast: string | null;
  variance: string | null;
}

export interface CostReportDTO {
  generatedAt: string;
  currencyBreakdown: CostReportCurrency[];
  costPerformanceIndex: number | null;
}

// ── Procurement ───────────────────────────────────────────────────────────────
export interface ProcurementReportDTO {
  generatedAt: string;
  materialRequests: { total: number; draft: number; submitted: number; approved: number; ordered: number; fulfilled: number; cancelled: number };
  purchaseOrders: { total: number; draft: number; pendingApproval: number; approved: number; sent: number; received: number; cancelled: number; totalCommittedAmount: string };
  deliveries: { total: number; scheduled: number; delivered: number; cancelled: number };
  receipts: { total: number; draft: number; posted: number; voided: number };
  inventoryItemCount: number;
}

// ── Subcontractor ─────────────────────────────────────────────────────────────
export interface SubcontractorPerformance {
  subcontractorId: string;
  displayName: string;
  trade: string | null;
  assignedTaskCount: number;
  completedTaskCount: number;
  lateTaskCount: number;
  lateDeliveryCount: number;
  receiptRejectionCount: number;
  onTimeRate: number | null;
}

export interface SubcontractorReportDTO {
  generatedAt: string;
  subcontractors: SubcontractorPerformance[];
}

// ── Executive Summary ─────────────────────────────────────────────────────────
export interface ExecutiveSummaryDTO {
  generatedAt: string;
  health: Omit<HealthReportDTO, 'generatedAt'>;
  schedule: Omit<ScheduleReportDTO, 'generatedAt'>;
  cost: Omit<CostReportDTO, 'generatedAt'>;
  procurement: Omit<ProcurementReportDTO, 'generatedAt'>;
}

// ── Notification ──────────────────────────────────────────────────────────────
export interface NotificationRecord {
  id: string;
  organizationId: string;
  projectId: string | null;
  recipientId: string;
  eventId: string | null;
  eventType: string;
  channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP';
  templateId: string | null;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  readAt: string | null;
  retryCount: number;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
}
