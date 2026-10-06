import { z } from 'zod';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});
const nullableText = (max = 5000) => z.string().trim().max(max).nullable().optional();
const memberId = z.string().min(1).max(128).nullable().optional();

export const createSubmittalSchema = z.object({
  title: z.string().trim().min(1).max(500),
  specReference: nullableText(255),
  discipline: nullableText(255),
  responsibleMemberId: memberId,
  reviewerMemberId: memberId,
  dueDate: dateSchema.nullable().optional(),
  notes: nullableText(),
});

export const updateSubmittalSchema = createSubmittalSchema.partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const reviewSubmittalSchema = z.object({
  response: z.enum(['APPROVED', 'APPROVED_WITH_COMMENTS', 'REVISE_AND_RESUBMIT', 'REJECTED']),
  responseNotes: nullableText(),
});

export const listSubmittalsQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum([
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'REVISE_AND_RESUBMIT',
    'CLOSED',
  ]).optional(),
});

export type CreateSubmittalInput = z.infer<typeof createSubmittalSchema>;
export type UpdateSubmittalInput = z.infer<typeof updateSubmittalSchema>;
export type ReviewSubmittalInput = z.infer<typeof reviewSubmittalSchema>;
export type ListSubmittalsQuery = z.infer<typeof listSubmittalsQuerySchema>;
