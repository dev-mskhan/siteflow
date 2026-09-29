// packages/database/src/schema/procurement.schema.ts
import {
  text,
  boolean,
  timestamp,
  numeric,
  date,
  index,
  uniqueIndex,
  check,
  integer,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { appSchema } from './auth.schema';
import { users } from './auth.schema';
import { organizations } from './org.schema';
import { projects, tasks, projectPhases, projectCostCodes, projectMembers } from './project.schema';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const subcontractorStatusEnum = appSchema.enum('subcontractor_status', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
]);

export const projectSubcontractorStatusEnum = appSchema.enum('project_subcontractor_status', [
  'ACTIVE',
  'INACTIVE',
]);

// ── Subcontractors ────────────────────────────────────────────────────────────

export const subcontractors = appSchema.table(
  'subcontractors',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    legalName: text('legal_name').notNull(),
    displayName: text('display_name').notNull(),
    trade: text('trade'),
    registrationReference: text('registration_reference'),
    taxReference: text('tax_reference'),
    status: subcontractorStatusEnum('status').notNull().default('ACTIVE'),
    primaryEmail: text('primary_email'),
    primaryPhone: text('primary_phone'),
    address: text('address'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('subcontractors_org_idx').on(t.organizationId),
    index('subcontractors_org_status_idx').on(t.organizationId, t.status),
    index('subcontractors_org_created_at_idx').on(t.organizationId, t.createdAt),
  ],
);

// ── Subcontractor Contacts ────────────────────────────────────────────────────
// NOTE: A partial unique index for isPrimary=true is added manually in migration SQL:
//   CREATE UNIQUE INDEX subcontractor_contacts_primary_unique
//     ON app.subcontractor_contacts(subcontractor_id)
//     WHERE is_primary = true;

export const subcontractorContacts = appSchema.table(
  'subcontractor_contacts',
  {
    id: text('id').primaryKey(),
    subcontractorId: text('subcontractor_id')
      .notNull()
      .references(() => subcontractors.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    role: text('role'),
    email: text('email'),
    phone: text('phone'),
    isPrimary: boolean('is_primary').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('subcontractor_contacts_sub_idx').on(t.subcontractorId),
    index('subcontractor_contacts_org_idx').on(t.organizationId),
  ],
);

// ── Project Subcontractors ────────────────────────────────────────────────────

export const projectSubcontractors = appSchema.table(
  'project_subcontractors',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    subcontractorId: text('subcontractor_id')
      .notNull()
      .references(() => subcontractors.id, { onDelete: 'restrict' }),
    status: projectSubcontractorStatusEnum('status').notNull().default('ACTIVE'),
    scopeDescription: text('scope_description'),
    contractValue: numeric('contract_value', { precision: 15, scale: 2 }),
    currencyCode: text('currency_code'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('project_subcontractors_project_idx').on(t.projectId),
    index('project_subcontractors_org_idx').on(t.organizationId),
    index('project_subcontractors_sub_idx').on(t.subcontractorId),
    index('project_subcontractors_project_sub_idx').on(t.projectId, t.subcontractorId),
    check(
      'project_subcontractors_dates_check',
      sql`${t.startDate} IS NULL OR ${t.endDate} IS NULL OR ${t.endDate} >= ${t.startDate}`,
    ),
    check(
      'project_subcontractors_currency_length',
      sql`${t.currencyCode} IS NULL OR char_length(${t.currencyCode}) = 3`,
    ),
  ],
);

// ── Subcontractor Task Assignments ────────────────────────────────────────────

export const subcontractorTaskAssignments = appSchema.table(
  'subcontractor_task_assignments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    subcontractorId: text('subcontractor_id')
      .notNull()
      .references(() => subcontractors.id, { onDelete: 'restrict' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    assignmentRole: text('assignment_role'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('sub_task_assignments_project_idx').on(t.projectId),
    index('sub_task_assignments_sub_idx').on(t.subcontractorId),
    index('sub_task_assignments_task_idx').on(t.taskId),
    index('sub_task_assignments_sub_task_idx').on(t.subcontractorId, t.taskId),
  ],
);

// ── TypeScript Types ──────────────────────────────────────────────────────────

export type Subcontractor = typeof subcontractors.$inferSelect;
export type SubcontractorContact = typeof subcontractorContacts.$inferSelect;
export type ProjectSubcontractor = typeof projectSubcontractors.$inferSelect;
export type SubcontractorTaskAssignment = typeof subcontractorTaskAssignments.$inferSelect;
export type SubcontractorStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

// ── Supplier Enums ────────────────────────────────────────────────────────────

export const supplierTypeEnum = appSchema.enum('supplier_type', [
  'MATERIAL_SUPPLIER',
  'SERVICE_PROVIDER',
  'EQUIPMENT_SUPPLIER',
  'GENERAL_SUPPLIER',
]);

export const supplierStatusEnum = appSchema.enum('supplier_status', [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
]);

// ── Suppliers ─────────────────────────────────────────────────────────────────

export const suppliers = appSchema.table(
  'suppliers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierCode: text('supplier_code').notNull(),
    legalName: text('legal_name').notNull(),
    displayName: text('display_name').notNull(),
    supplierType: supplierTypeEnum('supplier_type').notNull().default('GENERAL_SUPPLIER'),
    status: supplierStatusEnum('status').notNull().default('ACTIVE'),
    taxReference: text('tax_reference'),
    email: text('email'),
    phone: text('phone'),
    address: text('address'),
    website: text('website'),
    paymentTerms: text('payment_terms'),
    currencyCode: text('currency_code'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('suppliers_org_code_unique').on(t.organizationId, t.supplierCode),
    index('suppliers_org_idx').on(t.organizationId),
    index('suppliers_org_status_idx').on(t.organizationId, t.status),
  ],
);

// ── Supplier Contacts ─────────────────────────────────────────────────────────
// NOTE: Partial unique index for isPrimary=true added in migration SQL:
//   CREATE UNIQUE INDEX supplier_contacts_primary_unique
//     ON app.supplier_contacts(supplier_id) WHERE is_primary = true;

export const supplierContacts = appSchema.table(
  'supplier_contacts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    supplierId: text('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    role: text('role'),
    email: text('email'),
    phone: text('phone'),
    isPrimary: boolean('is_primary').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('supplier_contacts_supplier_idx').on(t.supplierId),
  ],
);

export type Supplier = typeof suppliers.$inferSelect;
export type SupplierContact = typeof supplierContacts.$inferSelect;
export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type SupplierType = 'MATERIAL_SUPPLIER' | 'SERVICE_PROVIDER' | 'EQUIPMENT_SUPPLIER' | 'GENERAL_SUPPLIER';

// ── Material Enums ────────────────────────────────────────────────────────────

export const materialTypeEnum = appSchema.enum('material_type', [
  'MATERIAL',
  'EQUIPMENT',
  'CONSUMABLE',
  'SERVICE',
  'OTHER',
]);

export const materialStatusEnum = appSchema.enum('material_status', ['ACTIVE', 'INACTIVE']);

// ── Materials ─────────────────────────────────────────────────────────────────

export const materials = appSchema.table(
  'materials',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    materialCode: text('material_code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    defaultUnitCode: text('default_unit_code').notNull(),
    materialType: materialTypeEnum('material_type').notNull().default('MATERIAL'),
    status: materialStatusEnum('status').notNull().default('ACTIVE'),
    defaultTaxCode: text('default_tax_code'),
    defaultCurrencyCode: text('default_currency_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('materials_org_code_unique').on(t.organizationId, t.materialCode),
    index('materials_org_idx').on(t.organizationId),
    index('materials_org_status_idx').on(t.organizationId, t.status),
    index('materials_org_category_idx').on(t.organizationId, t.category),
  ],
);

export type Material = typeof materials.$inferSelect;
export type MaterialStatus = 'ACTIVE' | 'INACTIVE';
export type MaterialType = 'MATERIAL' | 'EQUIPMENT' | 'CONSUMABLE' | 'SERVICE' | 'OTHER';

// ── Document Number Allocator ─────────────────────────────────────────────────
// NOTE: Two partial unique indexes must be added in migration SQL:
//   CREATE UNIQUE INDEX doc_num_allocator_proj_unique
//     ON app.document_number_allocators(organization_id, project_id, series, period)
//     WHERE project_id IS NOT NULL;
//   CREATE UNIQUE INDEX doc_num_allocator_org_unique
//     ON app.document_number_allocators(organization_id, series, period)
//     WHERE project_id IS NULL;

export const documentNumberAllocators = appSchema.table(
  'document_number_allocators',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    series: text('series').notNull(),
    period: text('period').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('doc_num_allocator_org_series_idx').on(t.organizationId, t.series, t.period),
  ],
);

export type DocumentNumberAllocator = typeof documentNumberAllocators.$inferSelect;

// ── Material Request Enums ────────────────────────────────────────────────────

export const materialRequestStatusEnum = appSchema.enum('material_request_status', [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'PARTIALLY_ORDERED',
  'ORDERED',
  'FULFILLED',
  'CANCELLED',
  'REJECTED',
]);

export const materialRequestPriorityEnum = appSchema.enum('material_request_priority', [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);

// ── Material Requests ─────────────────────────────────────────────────────────

export const materialRequests = appSchema.table(
  'material_requests',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    requestNumber: text('request_number').notNull(),
    requestedByMemberId: text('requested_by_member_id').references(() => projectMembers.id, {
      onDelete: 'set null',
    }),
    status: materialRequestStatusEnum('status').notNull().default('DRAFT'),
    requiredByDate: date('required_by_date'),
    deliveryLocation: text('delivery_location'),
    priority: materialRequestPriorityEnum('priority').notNull().default('NORMAL'),
    notes: text('notes'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('material_requests_num_unique').on(t.projectId, t.requestNumber),
    index('material_requests_project_status_created_idx').on(t.projectId, t.status, t.createdAt),
    index('material_requests_org_project_idx').on(t.organizationId, t.projectId),
  ],
);

export const materialRequestItems = appSchema.table(
  'material_request_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    materialRequestId: text('material_request_id')
      .notNull()
      .references(() => materialRequests.id, { onDelete: 'cascade' }),
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'restrict' }),
    description: text('description'),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    requiredByDate: date('required_by_date'),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
    costCodeId: text('cost_code_id').references(() => projectCostCodes.id, { onDelete: 'set null' }),
    boqLineId: text('boq_line_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('mat_req_items_request_idx').on(t.materialRequestId),
    index('mat_req_items_task_idx').on(t.taskId),
    check('mat_req_items_qty_gt_0', sql`${t.quantity} > 0`),
  ],
);

export type MaterialRequest = typeof materialRequests.$inferSelect;
export type MaterialRequestItem = typeof materialRequestItems.$inferSelect;
export type MaterialRequestStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED'
  | 'PARTIALLY_ORDERED' | 'ORDERED' | 'FULFILLED' | 'CANCELLED' | 'REJECTED';

// ── Quote Enums ───────────────────────────────────────────────────────────────

export const quoteStatusEnum = appSchema.enum('quote_status', [
  'DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED',
]);

// ── Quotes ────────────────────────────────────────────────────────────────────

export const quotes = appSchema.table(
  'quotes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    quoteNumber: text('quote_number').notNull(),
    supplierId: text('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
    materialRequestId: text('material_request_id').references(() => materialRequests.id, { onDelete: 'set null' }),
    status: quoteStatusEnum('status').notNull().default('DRAFT'),
    quoteDate: date('quote_date').notNull(),
    validUntil: date('valid_until'),
    currencyCode: text('currency_code').notNull(),
    subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex('quotes_num_unique').on(t.projectId, t.quoteNumber),
    index('quotes_project_status_idx').on(t.projectId, t.status),
    index('quotes_supplier_idx').on(t.supplierId),
    check('quotes_amounts_gte_0', sql`${t.subtotal} >= 0 AND ${t.taxAmount} >= 0 AND ${t.discountAmount} >= 0 AND ${t.totalAmount} >= 0`),
    check('quotes_valid_until', sql`${t.validUntil} IS NULL OR ${t.validUntil} >= ${t.quoteDate}`),
  ],
);

export const quoteItems = appSchema.table(
  'quote_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    quoteId: text('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
    materialRequestItemId: text('material_request_item_id').references(() => materialRequestItems.id, { onDelete: 'set null' }),
    materialId: text('material_id').notNull().references(() => materials.id, { onDelete: 'restrict' }),
    description: text('description'),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    lineSubtotal: numeric('line_subtotal', { precision: 15, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 15, scale: 2 }).notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index('quote_items_quote_idx').on(t.quoteId),
    check('quote_items_qty_gt_0', sql`${t.quantity} > 0`),
    check('quote_items_unit_price_gte_0', sql`${t.unitPrice} >= 0`),
  ],
);

export type Quote = typeof quotes.$inferSelect;
export type QuoteItem = typeof quoteItems.$inferSelect;
export type QuoteStatus = 'DRAFT' | 'SUBMITTED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

// ── Procurement Approval Enums ────────────────────────────────────────────────

export const procurementApprovalStatusEnum = appSchema.enum('procurement_approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
]);

export const procurementApprovalResourceTypeEnum = appSchema.enum(
  'procurement_approval_resource_type',
  ['MATERIAL_REQUEST', 'QUOTE', 'PURCHASE_ORDER'],
);

// ── Procurement Approvals ─────────────────────────────────────────────────────
// NOTE: Partial unique index for PENDING status added in migration SQL:
//   CREATE UNIQUE INDEX procurement_approvals_pending_unique
//     ON app.procurement_approvals(resource_type, resource_id)
//     WHERE status = 'PENDING';

export const procurementApprovals = appSchema.table(
  'procurement_approvals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    resourceType: procurementApprovalResourceTypeEnum('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    status: procurementApprovalStatusEnum('status').notNull().default('PENDING'),
    requestedBy: text('requested_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    decisionReason: text('decision_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('procurement_approvals_resource_idx').on(t.resourceType, t.resourceId),
    index('procurement_approvals_project_status_idx').on(t.projectId, t.status),
  ],
);

export type ProcurementApproval = typeof procurementApprovals.$inferSelect;
export type ProcurementApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ProcurementApprovalResourceType = 'MATERIAL_REQUEST' | 'QUOTE' | 'PURCHASE_ORDER';

// ── Purchase Order Enums ──────────────────────────────────────────────────────

export const purchaseOrderStatusEnum = appSchema.enum('purchase_order_status', [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'SENT',
  'ACKNOWLEDGED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
  'CLOSED',
]);

// ── Purchase Orders ───────────────────────────────────────────────────────────

export const purchaseOrders = appSchema.table(
  'purchase_orders',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    poNumber: text('po_number').notNull(),
    supplierId: text('supplier_id').notNull().references(() => suppliers.id, { onDelete: 'restrict' }),
    materialRequestId: text('material_request_id').references(() => materialRequests.id, { onDelete: 'set null' }),
    sourceQuoteId: text('source_quote_id').references(() => quotes.id, { onDelete: 'set null' }),
    status: purchaseOrderStatusEnum('status').notNull().default('DRAFT'),
    orderDate: date('order_date').notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    deliveryLocation: text('delivery_location'),
    currencyCode: text('currency_code').notNull(),
    subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull().default('0'),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    notes: text('notes'),
    createdByMemberId: text('created_by_member_id').references(() => projectMembers.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'set null' }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex('purchase_orders_num_unique').on(t.projectId, t.poNumber),
    index('purchase_orders_project_status_created_idx').on(t.projectId, t.status, t.createdAt),
    index('purchase_orders_supplier_idx').on(t.supplierId),
    index('purchase_orders_org_project_idx').on(t.organizationId, t.projectId),
    check('purchase_orders_amounts_gte_0', sql`${t.subtotal} >= 0 AND ${t.taxAmount} >= 0 AND ${t.discountAmount} >= 0 AND ${t.totalAmount} >= 0`),
    check('purchase_orders_delivery_date', sql`${t.expectedDeliveryDate} IS NULL OR ${t.expectedDeliveryDate} >= ${t.orderDate}`),
  ],
);

export const purchaseOrderItems = appSchema.table(
  'purchase_order_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    materialId: text('material_id').notNull().references(() => materials.id, { onDelete: 'restrict' }),
    description: text('description'),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    unitPrice: numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    lineSubtotal: numeric('line_subtotal', { precision: 15, scale: 2 }).notNull(),
    lineTotal: numeric('line_total', { precision: 15, scale: 2 }).notNull(),
    materialRequestItemId: text('material_request_item_id').references(() => materialRequestItems.id, { onDelete: 'set null' }),
    sourceQuoteItemId: text('source_quote_item_id').references(() => quoteItems.id, { onDelete: 'set null' }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
    costCodeId: text('cost_code_id').references(() => projectCostCodes.id, { onDelete: 'set null' }),
    boqLineId: text('boq_line_id'),
    expectedDeliveryDate: date('expected_delivery_date'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index('po_items_po_idx').on(t.purchaseOrderId),
    index('po_items_material_idx').on(t.materialId),
    index('po_items_task_idx').on(t.taskId),
    check('po_items_qty_gt_0', sql`${t.quantity} > 0`),
    check('po_items_unit_price_gte_0', sql`${t.unitPrice} >= 0`),
  ],
);

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type PurchaseOrderStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT' | 'ACKNOWLEDGED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED' | 'CLOSED';

// ── Committed Cost Enums ──────────────────────────────────────────────────────

export const committedCostStatusEnum = appSchema.enum('committed_cost_status', [
  'ACTIVE', 'RELEASED', 'CANCELLED',
]);

export const committedCostSourceTypeEnum = appSchema.enum('committed_cost_source_type', [
  'PURCHASE_ORDER',
]);

// ── Committed Costs ───────────────────────────────────────────────────────────

export const committedCosts = appSchema.table(
  'committed_costs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    sourceType: committedCostSourceTypeEnum('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    purchaseOrderId: text('purchase_order_id').references(() => purchaseOrders.id, { onDelete: 'set null' }),
    costCodeId: text('cost_code_id').references(() => projectCostCodes.id, { onDelete: 'set null' }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    boqLineId: text('boq_line_id'),
    currencyCode: text('currency_code').notNull(),
    committedAmount: numeric('committed_amount', { precision: 15, scale: 2 }).notNull(),
    status: committedCostStatusEnum('status').notNull().default('ACTIVE'),
    committedAt: timestamp('committed_at', { withTimezone: true }).notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex('committed_costs_source_unique').on(t.organizationId, t.sourceType, t.sourceId),
    index('committed_costs_project_idx').on(t.projectId),
    index('committed_costs_org_project_idx').on(t.organizationId, t.projectId),
  ],
);

export type CommittedCost = typeof committedCosts.$inferSelect;
export type CommittedCostStatus = 'ACTIVE' | 'RELEASED' | 'CANCELLED';
export type CommittedCostSourceType = 'PURCHASE_ORDER';

// ── Delivery & Receipt Enums ──────────────────────────────────────────────────

export const deliveryStatusEnum = appSchema.enum('delivery_status', [
  'SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED',
]);

export const receiptStatusEnum = appSchema.enum('receipt_status', [
  'DRAFT', 'POSTED', 'VOIDED',
]);

// ── Deliveries ────────────────────────────────────────────────────────────────

export const deliveries = appSchema.table(
  'deliveries',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'restrict' }),
    deliveryNumber: text('delivery_number').notNull(),
    status: deliveryStatusEnum('status').notNull().default('SCHEDULED'),
    scheduledDate: date('scheduled_date'),
    actualDeliveryDate: date('actual_delivery_date'),
    supplierReference: text('supplier_reference'),
    carrier: text('carrier'),
    trackingReference: text('tracking_reference'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex('deliveries_num_unique').on(t.projectId, t.deliveryNumber),
    index('deliveries_po_idx').on(t.purchaseOrderId),
    index('deliveries_project_status_scheduled_idx').on(t.projectId, t.status, t.scheduledDate),
  ],
);

export const deliveryItems = appSchema.table(
  'delivery_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    deliveryId: text('delivery_id').notNull().references(() => deliveries.id, { onDelete: 'cascade' }),
    purchaseOrderItemId: text('purchase_order_item_id').notNull().references(() => purchaseOrderItems.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    notes: text('notes'),
  },
  (t) => [
    index('delivery_items_delivery_idx').on(t.deliveryId),
    check('delivery_items_qty_gt_0', sql`${t.quantity} > 0`),
  ],
);

// ── Receipts ──────────────────────────────────────────────────────────────────

export const receipts = appSchema.table(
  'receipts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'restrict' }),
    deliveryId: text('delivery_id').references(() => deliveries.id, { onDelete: 'set null' }),
    receiptNumber: text('receipt_number').notNull(),
    status: receiptStatusEnum('status').notNull().default('DRAFT'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    receivedByMemberId: text('received_by_member_id').references(() => projectMembers.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('receipts_num_unique').on(t.projectId, t.receiptNumber),
    index('receipts_po_idx').on(t.purchaseOrderId),
    index('receipts_project_status_idx').on(t.projectId, t.status),
  ],
);

export const receiptItems = appSchema.table(
  'receipt_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    receiptId: text('receipt_id').notNull().references(() => receipts.id, { onDelete: 'cascade' }),
    purchaseOrderItemId: text('purchase_order_item_id').notNull().references(() => purchaseOrderItems.id, { onDelete: 'restrict' }),
    quantityDelivered: numeric('quantity_delivered', { precision: 15, scale: 3 }).notNull(),
    quantityAccepted: numeric('quantity_accepted', { precision: 15, scale: 3 }).notNull(),
    quantityRejected: numeric('quantity_rejected', { precision: 15, scale: 3 }).notNull().default('0'),
    unitCode: text('unit_code').notNull(),
    rejectionReason: text('rejection_reason'),
    condition: text('condition'),
    notes: text('notes'),
  },
  (t) => [
    index('receipt_items_receipt_idx').on(t.receiptId),
    index('receipt_items_po_item_idx').on(t.purchaseOrderItemId),
    check('receipt_items_qty_delivered_gte_0', sql`${t.quantityDelivered} >= 0`),
    check('receipt_items_qty_accepted_gte_0', sql`${t.quantityAccepted} >= 0`),
    check('receipt_items_qty_rejected_gte_0', sql`${t.quantityRejected} >= 0`),
    check('receipt_items_accepted_plus_rejected', sql`${t.quantityAccepted} + ${t.quantityRejected} <= ${t.quantityDelivered}`),
  ],
);

export type Delivery = typeof deliveries.$inferSelect;
export type DeliveryItem = typeof deliveryItems.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type ReceiptItem = typeof receiptItems.$inferSelect;
export type DeliveryStatus = 'SCHEDULED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
export type ReceiptStatus = 'DRAFT' | 'POSTED' | 'VOIDED';

// ── Inventory Enums ───────────────────────────────────────────────────────────

export const inventoryTransactionTypeEnum = appSchema.enum('inventory_transaction_type', [
  'RECEIPT', 'ISSUE', 'CONSUMPTION', 'RETURN',
  'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT',
]);

export const inventoryTransactionSourceTypeEnum = appSchema.enum(
  'inventory_transaction_source_type',
  ['RECEIPT', 'FIELD_LOG', 'ADJUSTMENT', 'TRANSFER', 'MANUAL'],
);

// ── Project Inventory Items (scope / lock target) ─────────────────────────────

export const projectInventoryItems = appSchema.table(
  'project_inventory_items',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    materialId: text('material_id').notNull().references(() => materials.id, { onDelete: 'restrict' }),
    location: text('location').notNull().default('default'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex('project_inventory_items_unique').on(t.projectId, t.materialId, t.location),
    index('project_inventory_items_project_idx').on(t.projectId),
  ],
);

// ── Inventory Transfers ───────────────────────────────────────────────────────

export const inventoryTransfers = appSchema.table(
  'inventory_transfers',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    materialId: text('material_id').notNull().references(() => materials.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    fromLocation: text('from_location').notNull(),
    toLocation: text('to_location').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdByMemberId: text('created_by_member_id').references(() => projectMembers.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('inv_transfers_project_idx').on(t.projectId),
    check('inv_transfers_different_locations', sql`${t.fromLocation} != ${t.toLocation}`),
    check('inv_transfers_qty_gt_0', sql`${t.quantity} > 0`),
  ],
);

// ── Inventory Transactions (append-only ledger) ───────────────────────────────

export const inventoryTransactions = appSchema.table(
  'inventory_transactions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    inventoryItemId: text('inventory_item_id').notNull().references(() => projectInventoryItems.id, { onDelete: 'restrict' }),
    materialId: text('material_id').notNull().references(() => materials.id, { onDelete: 'restrict' }),
    transactionType: inventoryTransactionTypeEnum('transaction_type').notNull(),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitCode: text('unit_code').notNull(),
    sourceType: inventoryTransactionSourceTypeEnum('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    transferId: text('transfer_id').references(() => inventoryTransfers.id, { onDelete: 'set null' }),
    reversalOfTransactionId: text('reversal_of_transaction_id'),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    costCodeId: text('cost_code_id').references(() => projectCostCodes.id, { onDelete: 'set null' }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdByMemberId: text('created_by_member_id').references(() => projectMembers.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('inv_tx_project_material_idx').on(t.projectId, t.materialId),
    index('inv_tx_org_project_idx').on(t.organizationId, t.projectId),
    index('inv_tx_source_idx').on(t.sourceType, t.sourceId),
    index('inv_tx_task_idx').on(t.taskId),
    index('inv_tx_transfer_idx').on(t.transferId),
    check('inv_tx_qty_gt_0', sql`${t.quantity} > 0`),
  ],
);

export type ProjectInventoryItem = typeof projectInventoryItems.$inferSelect;
export type InventoryTransfer = typeof inventoryTransfers.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InventoryTransactionType = 'RECEIPT' | 'ISSUE' | 'CONSUMPTION' | 'RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT';
export type InventoryTransactionSourceType = 'RECEIPT' | 'FIELD_LOG' | 'ADJUSTMENT' | 'TRANSFER' | 'MANUAL';

// ── Partner Performance Enums ─────────────────────────────────────────────────

export const partnerTypeEnum = appSchema.enum('partner_type', ['SUPPLIER', 'SUBCONTRACTOR']);

export const partnerPerformanceEventTypeEnum = appSchema.enum('partner_performance_event_type', [
  'DELIVERY_ON_TIME', 'DELIVERY_LATE', 'DELIVERY_PARTIAL', 'DELIVERY_CANCELLED',
  'RECEIPT_REJECTION', 'RECEIPT_DISCREPANCY', 'PO_CANCELLED',
  'WORK_COMPLETED', 'WORK_COMPLETED_LATE', 'WORK_DELAYED', 'SCOPE_CHANGE', 'QUALITY_ISSUE',
]);

// ── Partner Performance Events (append-only facts) ────────────────────────────

export const partnerPerformanceEvents = appSchema.table(
  'partner_performance_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').references(() => projects.id, { onDelete: 'set null' }),
    partnerType: partnerTypeEnum('partner_type').notNull(),
    supplierId: text('supplier_id').references(() => suppliers.id, { onDelete: 'set null' }),
    subcontractorId: text('subcontractor_id').references(() => subcontractors.id, { onDelete: 'set null' }),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    eventType: partnerPerformanceEventTypeEnum('event_type').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    metricValue: numeric('metric_value', { precision: 10, scale: 2 }),
    unit: text('unit'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('partner_perf_events_source_unique').on(t.sourceType, t.sourceId, t.eventType, t.supplierId, t.subcontractorId),
    index('partner_perf_events_supplier_idx').on(t.supplierId),
    index('partner_perf_events_sub_idx').on(t.subcontractorId),
    index('partner_perf_events_project_idx').on(t.projectId),
    index('partner_perf_events_source_idx').on(t.sourceType, t.sourceId),
  ],
);

export type PartnerPerformanceEvent = typeof partnerPerformanceEvents.$inferSelect;
export type PartnerType = 'SUPPLIER' | 'SUBCONTRACTOR';
export type PartnerPerformanceEventType =
  | 'DELIVERY_ON_TIME' | 'DELIVERY_LATE' | 'DELIVERY_PARTIAL' | 'DELIVERY_CANCELLED'
  | 'RECEIPT_REJECTION' | 'RECEIPT_DISCREPANCY' | 'PO_CANCELLED'
  | 'WORK_COMPLETED' | 'WORK_COMPLETED_LATE' | 'WORK_DELAYED' | 'SCOPE_CHANGE' | 'QUALITY_ISSUE';
