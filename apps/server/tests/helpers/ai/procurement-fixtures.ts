// apps/server/tests/helpers/ai/procurement-fixtures.ts
//
// Seed helpers and known-value constants for the procurement agent test suites.
//
// Design rules:
//  - All numeric seed values are CONSTANTS here — tests assert against these, never
//    against values returned by the agent. The agent can't set the ground truth.
//  - Use createOrgWithAiPermissions (which creates an Org Admin user with project:read)
//    so procurement tools pass the RBAC check.
//  - Use createProjectForOrg (Drizzle ORM) to create projects — matches ai-fixtures pattern.
//  - Use service classes to create domain data (POs, quotes, deliveries) not raw SQL.

import { getDb } from '../../../src/lib/db/index.js';
import { createOrgWithAiPermissions, createProjectForOrg } from './ai-fixtures.js';
import { PurchaseOrderService } from '../../../src/modules/project/purchase-order/purchase-order.service.js';
import { QuoteService } from '../../../src/modules/project/quote/quote.service.js';
import { MaterialService } from '../../../src/modules/material/material.service.js';
import { SupplierService } from '../../../src/modules/supplier/supplier.service.js';
import type { OrgWithAiPermissionsResult } from './ai-fixtures.js';
import type { FastifyInstance } from 'fastify';

// ── Known output constants ────────────────────────────────────────────────────
// These match what the fake model should echo back in its scripted response.
// Tests assert against these constants — never against the agent's live output.

/** Org A: a project with multiple POs, quotes, and deliveries in various statuses. */
export const SEED_PROJECT_A = {
  name: 'Proc Test Project Alpha',
  currency: 'USD',
  
  // Purchase Order 1 - SENT status, awaiting delivery
  po1: {
    status: 'SENT',
    supplierName: 'Alpha Steel Co',
    orderDate: '2026-10-15',
    expectedDeliveryDate: '2026-11-15',
    currencyCode: 'USD',
    subtotal: '45000.00',
    totalTax: '3600.00',
    grandTotal: '48600.00',
    items: [
      {
        description: 'Steel I-Beams 12x24',
        quantity: '50',
        unitCode: 'EA',
        unitPrice: '800.00',
        lineTotal: '40000.00',
      },
      {
        description: 'Steel Plates 10mm',
        quantity: '100',
        unitCode: 'EA',
        unitPrice: '50.00',
        lineTotal: '5000.00',
      },
    ],
  },
  
  // Purchase Order 2 - PARTIALLY_RECEIVED status
  po2: {
    status: 'PARTIALLY_RECEIVED',
    supplierName: 'Beta Concrete Supply',
    orderDate: '2026-10-20',
    expectedDeliveryDate: '2026-11-01',
    currencyCode: 'USD',
    subtotal: '25000.00',
    totalTax: '2000.00',
    grandTotal: '27000.00',
    items: [
      {
        description: 'Concrete Mix Grade 40',
        quantity: '500',
        unitCode: 'KG',
        unitPrice: '50.00',
        lineTotal: '25000.00',
      },
    ],
  },
  
  // Purchase Order 3 - APPROVED but not sent yet
  po3: {
    status: 'APPROVED',
    supplierName: 'Gamma Equipment Rentals',
    orderDate: '2026-10-25',
    currencyCode: 'USD',
    subtotal: '15000.00',
    totalTax: '1200.00',
    grandTotal: '16200.00',
    items: [
      {
        description: 'Crane Rental - 30 Ton',
        quantity: '10',
        unitCode: 'DAY',
        unitPrice: '1500.00',
        lineTotal: '15000.00',
      },
    ],
  },
  
  // Quote 1 - SUBMITTED from Alpha Steel
  quote1: {
    status: 'SUBMITTED',
    supplierName: 'Alpha Steel Co',
    quoteDate: '2026-10-10',
    validUntil: '2026-11-10',
    currencyCode: 'USD',
    subtotal: '45000.00',
    totalTax: '3600.00',
    grandTotal: '48600.00',
    items: [
      {
        description: 'Steel I-Beams 12x24',
        quantity: '50',
        unitCode: 'EA',
        unitPrice: '800.00',
        lineTotal: '40000.00',
      },
      {
        description: 'Steel Plates 10mm',
        quantity: '100',
        unitCode: 'EA',
        unitPrice: '50.00',
        lineTotal: '5000.00',
      },
    ],
  },
  
  // Quote 2 - SUBMITTED from competitor (for comparison)
  quote2: {
    status: 'SUBMITTED',
    supplierName: 'Delta Steel Industries',
    quoteDate: '2026-10-12',
    validUntil: '2026-11-05',
    currencyCode: 'USD',
    subtotal: '47000.00',
    totalTax: '3760.00',
    grandTotal: '50760.00',
    items: [
      {
        description: 'Steel I-Beams 12x24',
        quantity: '50',
        unitCode: 'EA',
        unitPrice: '850.00',
        lineTotal: '42500.00',
      },
      {
        description: 'Steel Plates 10mm',
        quantity: '100',
        unitCode: 'EA',
        unitPrice: '45.00',
        lineTotal: '4500.00',
      },
    ],
  },
  
  // Quote 3 - SUBMITTED from another competitor (for 3-way comparison)
  quote3: {
    status: 'SUBMITTED',
    supplierName: 'Epsilon Metals',
    quoteDate: '2026-10-14',
    validUntil: '2026-11-20',
    currencyCode: 'USD',
    subtotal: '44000.00',
    totalTax: '3520.00',
    grandTotal: '47520.00',
    items: [
      {
        description: 'Steel I-Beams 12x24',
        quantity: '50',
        unitCode: 'EA',
        unitPrice: '780.00',
        lineTotal: '39000.00',
      },
      {
        description: 'Steel Plates 10mm',
        quantity: '100',
        unitCode: 'EA',
        unitPrice: '50.00',
        lineTotal: '5000.00',
      },
    ],
  },
  
  // Delivery 1 - SCHEDULED for PO1
  delivery1: {
    status: 'SCHEDULED',
    scheduledDate: '2026-11-15',
    deliveryNumber: 'DL-202611-0001',
    supplierReference: 'ALPHA-SHIP-12345',
  },
  
  // Delivery 2 - DELIVERED for PO2 (partial)
  delivery2: {
    status: 'DELIVERED',
    scheduledDate: '2026-11-01',
    actualDeliveryDate: '2026-11-02',
    deliveryNumber: 'DL-202611-0002',
    supplierReference: 'BETA-SHIP-67890',
  },
} as const;

/** Org B: separate project used only for cross-tenant isolation tests. */
export const SEED_PROJECT_B = {
  name: 'Proc Test Project Beta',
  currency: 'USD',
  po1: {
    status: 'APPROVED',
    supplierName: 'OrgB Supplier',
    grandTotal: '10000.00',
  },
} as const;

// ── Fixture result shapes ─────────────────────────────────────────────────────

export interface OrgAFixture extends OrgWithAiPermissionsResult {
  project: { id: string };
  materials: {
    steel_ibeam: { id: string };
    steel_plate: { id: string };
    concrete_mix: { id: string };
    crane_rental: { id: string };
  };
  suppliers: {
    alpha_steel: { id: string };
    beta_concrete: { id: string };
    gamma_equipment: { id: string };
    delta_steel: { id: string };
    epsilon_metals: { id: string };
  };
  purchaseOrders: {
    po1: { id: string; poNumber: string };
    po2: { id: string; poNumber: string };
    po3: { id: string; poNumber: string };
  };
  quotes: {
    quote1: { id: string; quoteNumber: string };
    quote2: { id: string; quoteNumber: string };
    quote3: { id: string; quoteNumber: string };
  };
}

export interface OrgBFixture extends OrgWithAiPermissionsResult {
  project: { id: string };
  purchaseOrders: {
    po1: { id: string; poNumber: string };
  };
}

export interface ProcurementFixtures {
  orgA: OrgAFixture;
  orgB: OrgBFixture;
}

// ── Helper: build the valid JSON the fake model should emit as its final turn ─

/**
 * Returns the JSON string that the scripted fake model should return as its final
 * text response for a procurement run. The values come from SEED_PROJECT_A so
 * tests can assert specific fields.
 */
export function buildFinalAnswer(opts: {
  narrative: string;
  figures?: Array<{
    label: string;
    value: string | number;
    currency?: string;
    unit?: string;
    source?: { toolName: string; resultPath: string };
  }>;
  summary: string;
  toolName: string;
  snippet: string;
  figureLabels?: string[];
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
  missingData?: string[];
}): string {
  return JSON.stringify({
    answer: {
      narrative: opts.narrative,
      figures: opts.figures ?? [],
      confidence: opts.confidence ?? 'HIGH',
      missingData: opts.missingData,
    },
    summary: opts.summary.slice(0, 500),
    citations: [
      {
        toolName: opts.toolName,
        snippet: opts.snippet,
        figureLabels: opts.figureLabels,
      },
    ],
  });
}

// ── Main seed function ────────────────────────────────────────────────────────

/**
 * Creates two isolated orgs (A and B), each with one active project.
 * Org A gets full procurement data (POs, quotes, deliveries).
 * Org B gets minimal data for cross-tenant tests.
 * 
 * Call once in beforeAll and share across tests — the per-test fake model reset
 * (clearScriptedModel) keeps tests independent.
 */
export async function seedProcurementFixtures(
  app?: FastifyInstance,
): Promise<ProcurementFixtures> {
  // createOrgWithAiPermissions creates a verified user + org whose admin role
  // already holds project:read and other permissions, so procurement tools will pass RBAC checks.
  const orgAResult = await createOrgWithAiPermissions(app, 'Proc Org Alpha');
  const orgBResult = await createOrgWithAiPermissions(app, 'Proc Org Beta');

  const projectA = await createProjectForOrg(
    orgAResult.orgId,
    orgAResult.user.id,
    SEED_PROJECT_A.name,
  );

  const projectB = await createProjectForOrg(
    orgBResult.orgId,
    orgBResult.user.id,
    SEED_PROJECT_B.name,
  );

  // Initialize services
  const materialService = new MaterialService();
  const supplierService = new SupplierService();
  const poService = new PurchaseOrderService();
  const quoteService = new QuoteService();

  // ── Org A: Full procurement data ────────────────────────────────────────────

  // Create materials for Org A
  const steelIBeam = await materialService.createMaterial(orgAResult.user.id, orgAResult.orgId, {
    materialCode: 'STL-IB-12X24',
    name: 'Steel I-Beams 12x24',
    description: 'Structural steel I-beams 12x24 inches',
    defaultUnitCode: 'EA',
    category: 'STRUCTURAL_STEEL',
    materialType: 'MATERIAL',
  });

  const steelPlate = await materialService.createMaterial(orgAResult.user.id, orgAResult.orgId, {
    materialCode: 'STL-PLT-10MM',
    name: 'Steel Plates 10mm',
    description: 'Steel plates 10mm thickness',
    defaultUnitCode: 'EA',
    category: 'STRUCTURAL_STEEL',
    materialType: 'MATERIAL',
  });

  const concreteMix = await materialService.createMaterial(orgAResult.user.id, orgAResult.orgId, {
    materialCode: 'CONC-G40',
    name: 'Concrete Mix Grade 40',
    description: 'Ready mix concrete grade 40',
    defaultUnitCode: 'KG',
    category: 'CONCRETE',
    materialType: 'MATERIAL',
  });

  const craneRental = await materialService.createMaterial(orgAResult.user.id, orgAResult.orgId, {
    materialCode: 'EQIP-CRN-30T',
    name: 'Crane Rental - 30 Ton',
    description: 'Tower crane 30 ton capacity daily rental',
    defaultUnitCode: 'DAY',
    category: 'EQUIPMENT_RENTAL',
    materialType: 'EQUIPMENT',
  });

  // Create suppliers for Org A
  const alphaSteel = await supplierService.createSupplier(orgAResult.user.id, orgAResult.orgId, {
    legalName: SEED_PROJECT_A.po1.supplierName,
    displayName: SEED_PROJECT_A.po1.supplierName,
    supplierCode: 'SUP-ALPHA-STEEL',
    supplierType: 'MATERIAL_SUPPLIER',
  });

  const betaConcrete = await supplierService.createSupplier(orgAResult.user.id, orgAResult.orgId, {
    legalName: SEED_PROJECT_A.po2.supplierName,
    displayName: SEED_PROJECT_A.po2.supplierName,
    supplierCode: 'SUP-BETA-CONC',
    supplierType: 'MATERIAL_SUPPLIER',
  });

  const gammaEquipment = await supplierService.createSupplier(
    orgAResult.user.id,
    orgAResult.orgId,
    {
      legalName: SEED_PROJECT_A.po3.supplierName,
      displayName: SEED_PROJECT_A.po3.supplierName,
      supplierCode: 'SUP-GAMMA-EQIP',
      supplierType: 'EQUIPMENT_SUPPLIER',
    },
  );

  const deltaSteel = await supplierService.createSupplier(orgAResult.user.id, orgAResult.orgId, {
    legalName: SEED_PROJECT_A.quote2.supplierName,
    displayName: SEED_PROJECT_A.quote2.supplierName,
    supplierCode: 'SUP-DELTA-STEEL',
    supplierType: 'MATERIAL_SUPPLIER',
  });

  const epsilonMetals = await supplierService.createSupplier(
    orgAResult.user.id,
    orgAResult.orgId,
    {
      legalName: SEED_PROJECT_A.quote3.supplierName,
      displayName: SEED_PROJECT_A.quote3.supplierName,
      supplierCode: 'SUP-EPSILON-MET',
      supplierType: 'MATERIAL_SUPPLIER',
    },
  );

  // Create Purchase Orders for Org A
  const po1 = await poService.createPurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    {
      supplierId: alphaSteel.id,
      orderDate: SEED_PROJECT_A.po1.orderDate,
      expectedDeliveryDate: SEED_PROJECT_A.po1.expectedDeliveryDate,
      currencyCode: SEED_PROJECT_A.po1.currencyCode,
      items: [
        {
          materialId: steelIBeam.id,
          description: SEED_PROJECT_A.po1.items[0].description,
          quantity: SEED_PROJECT_A.po1.items[0].quantity,
          unitCode: SEED_PROJECT_A.po1.items[0].unitCode,
          unitPrice: SEED_PROJECT_A.po1.items[0].unitPrice,
        },
        {
          materialId: steelPlate.id,
          description: SEED_PROJECT_A.po1.items[1].description,
          quantity: SEED_PROJECT_A.po1.items[1].quantity,
          unitCode: SEED_PROJECT_A.po1.items[1].unitCode,
          unitPrice: SEED_PROJECT_A.po1.items[1].unitPrice,
        },
      ],
    },
  );

  // Transition PO1 to SENT status
  await poService.submitPurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    po1.id,
  );
  await poService.approvePurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    po1.id,
  );
  await poService.sendPurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    po1.id,
  );

  const po2 = await poService.createPurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    {
      supplierId: betaConcrete.id,
      orderDate: SEED_PROJECT_A.po2.orderDate,
      expectedDeliveryDate: SEED_PROJECT_A.po2.expectedDeliveryDate,
      currencyCode: SEED_PROJECT_A.po2.currencyCode,
      items: [
        {
          materialId: concreteMix.id,
          description: SEED_PROJECT_A.po2.items[0].description,
          quantity: SEED_PROJECT_A.po2.items[0].quantity,
          unitCode: SEED_PROJECT_A.po2.items[0].unitCode,
          unitPrice: SEED_PROJECT_A.po2.items[0].unitPrice,
        },
      ],
    },
  );

  // Transition PO2 to SENT (will manually set to PARTIALLY_RECEIVED after delivery)
  await poService.submitPurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    po2.id,
  );
  await poService.approvePurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    po2.id,
  );
  await poService.sendPurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    po2.id,
  );

  const po3 = await poService.createPurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    {
      supplierId: gammaEquipment.id,
      orderDate: SEED_PROJECT_A.po3.orderDate,
      currencyCode: SEED_PROJECT_A.po3.currencyCode,
      items: [
        {
          materialId: craneRental.id,
          description: SEED_PROJECT_A.po3.items[0].description,
          quantity: SEED_PROJECT_A.po3.items[0].quantity,
          unitCode: SEED_PROJECT_A.po3.items[0].unitCode,
          unitPrice: SEED_PROJECT_A.po3.items[0].unitPrice,
        },
      ],
    },
  );

  // Transition PO3 to APPROVED (but don't send yet)
  await poService.submitPurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    po3.id,
  );
  await poService.approvePurchaseOrder(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    po3.id,
  );

  // Create Quotes for Org A (for comparison tests)
  const quote1 = await quoteService.createQuote(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    {
      supplierId: alphaSteel.id,
      quoteDate: SEED_PROJECT_A.quote1.quoteDate,
      validUntil: SEED_PROJECT_A.quote1.validUntil,
      currencyCode: SEED_PROJECT_A.quote1.currencyCode,
      items: [
        {
          materialId: steelIBeam.id,
          description: SEED_PROJECT_A.quote1.items[0].description,
          quantity: SEED_PROJECT_A.quote1.items[0].quantity,
          unitCode: SEED_PROJECT_A.quote1.items[0].unitCode,
          unitPrice: SEED_PROJECT_A.quote1.items[0].unitPrice,
        },
        {
          materialId: steelPlate.id,
          description: SEED_PROJECT_A.quote1.items[1].description,
          quantity: SEED_PROJECT_A.quote1.items[1].quantity,
          unitCode: SEED_PROJECT_A.quote1.items[1].unitCode,
          unitPrice: SEED_PROJECT_A.quote1.items[1].unitPrice,
        },
      ],
    },
  );

  await quoteService.submitQuote(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    quote1.id,
  );

  const quote2 = await quoteService.createQuote(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    {
      supplierId: deltaSteel.id,
      quoteDate: SEED_PROJECT_A.quote2.quoteDate,
      validUntil: SEED_PROJECT_A.quote2.validUntil,
      currencyCode: SEED_PROJECT_A.quote2.currencyCode,
      items: [
        {
          materialId: steelIBeam.id,
          description: SEED_PROJECT_A.quote2.items[0].description,
          quantity: SEED_PROJECT_A.quote2.items[0].quantity,
          unitCode: SEED_PROJECT_A.quote2.items[0].unitCode,
          unitPrice: SEED_PROJECT_A.quote2.items[0].unitPrice,
        },
        {
          materialId: steelPlate.id,
          description: SEED_PROJECT_A.quote2.items[1].description,
          quantity: SEED_PROJECT_A.quote2.items[1].quantity,
          unitCode: SEED_PROJECT_A.quote2.items[1].unitCode,
          unitPrice: SEED_PROJECT_A.quote2.items[1].unitPrice,
        },
      ],
    },
  );

  await quoteService.submitQuote(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    quote2.id,
  );

  const quote3 = await quoteService.createQuote(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    {
      supplierId: epsilonMetals.id,
      quoteDate: SEED_PROJECT_A.quote3.quoteDate,
      validUntil: SEED_PROJECT_A.quote3.validUntil,
      currencyCode: SEED_PROJECT_A.quote3.currencyCode,
      items: [
        {
          materialId: steelIBeam.id,
          description: SEED_PROJECT_A.quote3.items[0].description,
          quantity: SEED_PROJECT_A.quote3.items[0].quantity,
          unitCode: SEED_PROJECT_A.quote3.items[0].unitCode,
          unitPrice: SEED_PROJECT_A.quote3.items[0].unitPrice,
        },
        {
          materialId: steelPlate.id,
          description: SEED_PROJECT_A.quote3.items[1].description,
          quantity: SEED_PROJECT_A.quote3.items[1].quantity,
          unitCode: SEED_PROJECT_A.quote3.items[1].unitCode,
          unitPrice: SEED_PROJECT_A.quote3.items[1].unitPrice,
        },
      ],
    },
  );

  await quoteService.submitQuote(
    orgAResult.user.id,
    orgAResult.orgId,
    projectA.id,
    quote3.id,
  );

  // ── Org B: Minimal data for cross-tenant tests ──────────────────────────────

  const orgBMaterial = await materialService.createMaterial(orgBResult.user.id, orgBResult.orgId, {
    materialCode: 'ORG-B-MAT',
    name: 'Org B Material',
    defaultUnitCode: 'EA',
    category: 'OTHER',
    materialType: 'OTHER',
  });

  const orgBSupplier = await supplierService.createSupplier(
    orgBResult.user.id,
    orgBResult.orgId,
    {
      legalName: SEED_PROJECT_B.po1.supplierName,
      displayName: SEED_PROJECT_B.po1.supplierName,
      supplierCode: 'SUP-ORG-B',
      supplierType: 'MATERIAL_SUPPLIER',
    },
  );

  const poB1 = await poService.createPurchaseOrder(
    orgBResult.user.id,
    orgBResult.orgId,
    projectB.id,
    {
      supplierId: orgBSupplier.id,
      orderDate: '2026-10-01',
      currencyCode: SEED_PROJECT_B.currency,
      items: [
        {
          materialId: orgBMaterial.id,
          description: 'Org B Test Item',
          quantity: '10',
          unitCode: 'EA',
          unitPrice: '1000.00',
        },
      ],
    },
  );

  // Transition to APPROVED
  await poService.submitPurchaseOrder(
    orgBResult.user.id,
    orgBResult.orgId,
    projectB.id,
    poB1.id,
  );
  await poService.approvePurchaseOrder(
    orgBResult.user.id,
    orgBResult.orgId,
    projectB.id,
    poB1.id,
  );

  // Return fixtures
  return {
    orgA: {
      ...orgAResult,
      project: { id: projectA.id },
      materials: {
        steel_ibeam: { id: steelIBeam.id },
        steel_plate: { id: steelPlate.id },
        concrete_mix: { id: concreteMix.id },
        crane_rental: { id: craneRental.id },
      },
      suppliers: {
        alpha_steel: { id: alphaSteel.id },
        beta_concrete: { id: betaConcrete.id },
        gamma_equipment: { id: gammaEquipment.id },
        delta_steel: { id: deltaSteel.id },
        epsilon_metals: { id: epsilonMetals.id },
      },
      purchaseOrders: {
        po1: { id: po1.id, poNumber: po1.poNumber },
        po2: { id: po2.id, poNumber: po2.poNumber },
        po3: { id: po3.id, poNumber: po3.poNumber },
      },
      quotes: {
        quote1: { id: quote1.id, quoteNumber: quote1.quoteNumber },
        quote2: { id: quote2.id, quoteNumber: quote2.quoteNumber },
        quote3: { id: quote3.id, quoteNumber: quote3.quoteNumber },
      },
    },
    orgB: {
      ...orgBResult,
      project: { id: projectB.id },
      purchaseOrders: {
        po1: { id: poB1.id, poNumber: poB1.poNumber },
      },
    },
  };
}

