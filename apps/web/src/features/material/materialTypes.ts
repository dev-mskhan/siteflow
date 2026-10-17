/**
 * materialTypes.ts — mirrors server DTOs exactly.
 *
 * Sources:
 *   MaterialDTO → material/material.types.ts
 *   Validation  → @siteflow/shared material.schema.ts
 *
 * NOTES:
 *   - materialCode: 1–100
 *   - name: 1–500; description: max 2000; category: max 200
 *   - defaultUnitCode: 1–20, uppercase
 *   - defaultCurrencyCode: exactly 3 chars, uppercase
 *   - List pagination: cursor + limit (1–100, default 50) + status + category filter
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type MaterialStatus = 'ACTIVE' | 'INACTIVE';

export type MaterialType =
  | 'MATERIAL'
  | 'EQUIPMENT'
  | 'CONSUMABLE'
  | 'SERVICE'
  | 'OTHER';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface MaterialDTO {
  id: string;
  organizationId: string;
  materialCode: string;
  name: string;
  description: string | null;
  category: string | null;
  defaultUnitCode: string;
  materialType: MaterialType;
  status: MaterialStatus;
  defaultTaxCode: string | null;
  defaultCurrencyCode: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateMaterialInput {
  materialCode: string;       // 1–100
  name: string;               // 1–500
  description?: string;       // max 2000
  category?: string;          // max 200
  defaultUnitCode: string;    // 1–20, uppercase
  materialType?: MaterialType;
  defaultTaxCode?: string;    // max 50
  defaultCurrencyCode?: string; // exactly 3 chars, uppercase
}

export interface UpdateMaterialInput {
  name?: string;
  description?: string;
  category?: string;
  defaultUnitCode?: string;
  materialType?: MaterialType;
  status?: MaterialStatus;
  defaultTaxCode?: string;
  defaultCurrencyCode?: string;
}

// ── List query ────────────────────────────────────────────────────────────────

export interface ListMaterialsQuery {
  cursor?: string;
  limit?: number;
  status?: MaterialStatus;
  category?: string;
}
