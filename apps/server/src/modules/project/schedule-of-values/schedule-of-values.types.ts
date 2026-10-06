import type {
  ScheduleOfValueLine,
  ScheduleOfValueRevision,
  ScheduleOfValues,
} from '@siteflow/database/schema';

export type ScheduleOfValueLineDTO = Omit<ScheduleOfValueLine, 'createdAt'> & {
  createdAt: string;
  remainingValue: string;
  retainageAmount: string;
};

export type ScheduleOfValuesDTO = Omit<ScheduleOfValues, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
  revision: Omit<ScheduleOfValueRevision, 'createdAt' | 'submittedAt' | 'approvedAt'> & {
    createdAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
  };
  lines: ScheduleOfValueLineDTO[];
  baseContractValue: string;
  effectiveChangeOrderRevenue: string;
  currentContractValue: string;
};
