// apps/server/src/modules/ai/tools/definitions/knowledge.tools.ts
//
// READ-tier tools for the OKF v0.2 knowledge bundle and vector RAG.
//
// read_okf_page  — reads OKF concept files from the bundled Markdown bundle
// search_knowledge_base — graph-augmented vector search (added after W3.2.5)

import { z } from 'zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerTool } from '../tool-registry.js';

// ── Bundle root (resolved relative to this file at compile time) ──────────────
// packages/shared/okf/siteflow lives 6 directories up from
// apps/server/src/modules/ai/tools/definitions/
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BUNDLE_ROOT = join(
  __dirname,
  '../../../../../../packages/shared/okf/siteflow',
);

// ── OKF trust tier derivation ─────────────────────────────────────────────────

type TrustTier = 'unverified' | 'machine-confirmed' | 'human-reviewed';

function deriveTrustTier(frontmatter: string): TrustTier {
  if (!frontmatter.includes('verified:')) return 'unverified';
  if (/human:/.test(frontmatter)) return 'human-reviewed';
  return 'machine-confirmed';
}

function isStale(frontmatter: string): boolean {
  const match = frontmatter.match(/stale_after:\s*['"]?([^'"}\n]+)['"]?/);
  if (!match) return false;
  return new Date() >= new Date(match[1]!.trim());
}

function extractFrontmatter(content: string): {
  raw: string;
  body: string;
  type: string;
  title: string;
  description: string;
  status: string;
} {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    return { raw: '', body: content, type: 'Unknown', title: '', description: '', status: 'stable' };
  }
  const raw = fmMatch[1]!;
  const body = fmMatch[2]!;

  const typeMatch = raw.match(/^type:\s*(.+)$/m);
  const titleMatch = raw.match(/^title:\s*(.+)$/m);
  const descMatch = raw.match(/^description:\s*(.+)$/m);
  const statusMatch = raw.match(/^status:\s*(.+)$/m);

  return {
    raw,
    body: body.trim(),
    type: typeMatch?.[1]?.trim() ?? 'Unknown',
    title: titleMatch?.[1]?.trim() ?? '',
    description: descMatch?.[1]?.trim() ?? '',
    status: statusMatch?.[1]?.trim() ?? 'stable',
  };
}

function readConcept(pagePath: string): {
  content: string;
  type: string;
  title: string;
  description: string;
  status: string;
  trustTier: TrustTier;
  stale: boolean;
} | null {
  // Normalise: strip leading slash, ensure .md extension
  const clean = pagePath.replace(/^\//, '').replace(/\.md$/, '');
  const fullPath = join(BUNDLE_ROOT, `${clean}.md`);

  if (!existsSync(fullPath)) return null;

  const raw = readFileSync(fullPath, 'utf-8');
  const fm = extractFrontmatter(raw);

  return {
    content: fm.body,
    type: fm.type,
    title: fm.title,
    description: fm.description,
    status: fm.status,
    trustTier: deriveTrustTier(fm.raw),
    stale: isStale(fm.raw),
  };
}

// ── 1. read_okf_page ──────────────────────────────────────────────────────────

registerTool({
  name: 'read_okf_page',
  description:
    'Reads a concept from the SiteFlow OKF v0.2 knowledge bundle. ' +
    'Call with browse=true first to see the full index of available concepts. ' +
    'Then call with a pageName to read a specific concept (e.g. "metrics/budget-variance", ' +
    '"tables/quality-deficiencies", "references/agent-catalog"). ' +
    'Returns the concept body, type, trust tier (unverified / machine-confirmed / human-reviewed), ' +
    'and stale flag. Use this to understand domain definitions and agent boundaries before answering.',
  argsSchema: z.object({
    browse: z
      .boolean()
      .optional()
      .describe('Set to true to return the root index listing all available concepts.'),
    pageName: z
      .string()
      .optional()
      .describe(
        'Path to the concept relative to the bundle root, without .md extension. ' +
        'Examples: "metrics/budget-variance", "tables/quality-deficiencies", ' +
        '"references/agent-catalog", "playbooks/deficiency-response".',
      ),
  }),
  riskTier: 'READ',
  requiredPermission: '',   // platform-level knowledge — no project permission needed
  async execute({ browse, pageName }) {
    // Browse mode: return the root index
    if (browse || (!pageName)) {
      const indexPath = join(BUNDLE_ROOT, 'index.md');
      if (!existsSync(indexPath)) {
        return { error: 'OKF bundle index not found', bundleRoot: BUNDLE_ROOT };
      }
      const content = readFileSync(indexPath, 'utf-8');
      return {
        type: 'Index',
        title: 'SiteFlow Knowledge Bundle',
        description: 'Root index of all available OKF concepts',
        trustTier: 'human-reviewed' as TrustTier,
        stale: false,
        content: content.replace(/^---[\s\S]*?---\n/, '').trim(),
      };
    }

    // Read a specific concept
    const result = readConcept(pageName);
    if (!result) {
      // Try to help the agent navigate: return the index of the parent directory
      const parts = pageName.split('/');
      const dirIndex = parts.length > 1
        ? readConcept(parts.slice(0, -1).join('/') + '/index')
        : null;

      return {
        error: `Concept "${pageName}" not found in OKF bundle.`,
        hint: dirIndex
          ? `Available in that directory:\n${dirIndex.content}`
          : 'Call with browse=true to see all available concepts.',
      };
    }

    return result;
  },
});

// ── search_knowledge_base is registered below ──────────────────────────────

// ── 2. search_knowledge_base ──────────────────────────────────────────────────
// Graph-augmented vector search: finds semantically similar document chunks
// AND enriches results with linked entity context via SQL JOINs on existing
// entity relationships. One embedding call + one SQL query = zero extra API cost.

import { getDb } from '../../../../lib/db/index.js';
import { sql as drizzleSql } from 'drizzle-orm';
import { embedQuery } from '../../ingestion/embedder.js';

registerTool({
  name: 'search_knowledge_base',
  description:
    'Searches project documents using vector similarity (semantic search). ' +
    'Returns the most relevant text chunks along with source document info ' +
    'and any linked project entities (quality inspections, deficiencies, permits, ' +
    'takeoff sources). Returns empty when no close matches exist. ' +
    'Use to find what project documents say about a topic, specification, or requirement.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project to search within.'),
    query: z.string().min(3).max(1000).describe('Describe what you are looking for.'),
    limit: z.number().int().min(1).max(10).default(5).describe('Max results (1-10, default 5).'),
    category: z
      .enum(['DRAWING', 'SPECIFICATION', 'PERMIT', 'CERTIFICATE', 'REPORT', 'PHOTO', 'VIDEO', 'CONTRACT', 'INVOICE', 'OTHER'])
      .optional()
      .describe('Optional: filter to a specific document category.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.document.download',
  async execute({ projectId, query, limit = 5, category }, ctx) {
    // 1. Embed the query
    const queryVector = await embedQuery(query);
    const vectorStr = `[${queryVector.join(',')}]`;

    const db = getDb();

    // 2. Graph-augmented vector search using Drizzle sql template
    //    The <=> operator requires the vector literal to be cast explicitly.
    const rows = await db.execute(drizzleSql`
      WITH relevant_chunks AS (
        SELECT
          kc.id,
          kc.content,
          kc.document_id,
          kc.document_version_id,
          kc.version_number,
          kc.page_reference,
          1 - (kc.embedding <=> ${vectorStr}::vector) AS similarity
        FROM app.knowledge_chunks kc
        WHERE kc.organization_id = ${ctx.organizationId}
          AND kc.project_id = ${projectId}
          AND kc.status = 'ACTIVE'
        ORDER BY kc.embedding <=> ${vectorStr}::vector
        LIMIT ${limit}
      )
      SELECT
        rc.id,
        rc.content,
        rc.document_id            AS "documentId",
        rc.document_version_id    AS "documentVersionId",
        rc.version_number         AS "versionNumber",
        rc.page_reference         AS "pageReference",
        rc.similarity,
        d.title                   AS "documentTitle",
        d.category                AS "documentCategory",
        (
          SELECT json_agg(json_build_object('id', qi.id, 'inspectionNumber', qi.inspection_number, 'status', qi.status, 'result', qi.result))
          FROM app.document_entity_links del
          JOIN app.quality_inspections qi ON qi.id = del.entity_id
          WHERE del.document_id = rc.document_id AND del.entity_type = 'quality_inspection'
        ) AS "linkedInspections",
        (
          SELECT json_agg(json_build_object('id', qd.id, 'deficiencyNumber', qd.deficiency_number, 'title', qd.title, 'status', qd.status, 'severity', qd.severity))
          FROM app.document_entity_links del
          JOIN app.quality_deficiencies qd ON qd.id = del.entity_id
          WHERE del.document_id = rc.document_id AND del.entity_type = 'quality_deficiency'
        ) AS "linkedDeficiencies",
        (
          SELECT json_agg(json_build_object('id', p.id, 'permitType', p.permit_type, 'status', p.status, 'expiryDate', p.expiry_date))
          FROM app.document_entity_links del
          JOIN app.permits p ON p.id = del.entity_id
          WHERE del.document_id = rc.document_id AND del.entity_type = 'permit'
        ) AS "linkedPermits",
        (
          SELECT json_agg(json_build_object('sheetId', ts.sheet_id, 'pageReference', tso.page_reference, 'boqItemDescription', bi.description))
          FROM app.takeoff_sources tso
          JOIN app.takeoff_sheet_revisions tsr ON tsr.id = tso.revision_id
          JOIN app.takeoff_sheets ts ON ts.id = tsr.sheet_id
          LEFT JOIN app.takeoff_measurements tm ON tm.source_id = tso.id
          LEFT JOIN app.boq_items bi ON bi.id = tm.boq_item_id
          WHERE tso.document_id = rc.document_id
        ) AS "linkedTakeoffs"
      FROM relevant_chunks rc
      JOIN app.documents d ON d.id = rc.document_id
      ${category ? drizzleSql`AND d.category = ${category}` : drizzleSql``}
      WHERE rc.similarity >= 0.25
      ORDER BY rc.similarity DESC
    `) as unknown as any[];

    // Also fetch APPROVED OKF pages for this organization
    const okfPages = await db.execute(drizzleSql`
      SELECT
        id,
        page_path AS "pagePath",
        title,
        content,
        version,
        approved_at AS "approvedAt"
      FROM app.okf_pages
      WHERE organization_id = ${ctx.organizationId}
        AND status = 'APPROVED'
      ORDER BY approved_at DESC
      LIMIT 5
    `) as unknown as any[];

    if ((!rows || rows.length === 0) && (!okfPages || okfPages.length === 0)) {
      return {
        chunks: [],
        okfPages: [],
        message: 'not found in documents or knowledge base — no sufficiently similar content found for this query.',
      };
    }

    return { chunks: rows || [], okfPages: okfPages || [], message: null };
  },
});


// ── 3. propose_okf_page ───────────────────────────────────────────────────────
// Learning loop: Agent proposes OKF knowledge page based on user correction

import { OkfService } from '../../okf/okf.service.js';

registerTool({
  name: 'propose_okf_page',
  description:
    'Propose a new OKF knowledge page based on user correction. ' +
    'Creates a DRAFT page that requires admin approval before being served to agents. ' +
    'Use when a user corrects your answer and the correction should become org knowledge.',
  argsSchema: z.object({
    pagePath: z
      .string()
      .regex(/^[a-z0-9\/-]+$/)
      .describe('Path for the page (e.g., "corrections/cost-code-naming"). Use lowercase, hyphens, slashes only.'),
    title: z.string().max(200).describe('Brief title for the knowledge page'),
    content: z.string().max(5000).describe('Markdown content explaining the correction'),
    correctionContext: z.object({
      originalQuestion: z.string(),
      agentAnswer: z.string(),
      userCorrection: z.string(),
      timestamp: z.string(),
    }).describe('Context about what was corrected'),
  }),
  riskTier: 'WRITE',
  requiredPermission: 'okf:propose', // Auto-granted to agents
  async execute({ pagePath, title, content, correctionContext }, ctx) {
    const okfService = new OkfService();

    const page = await okfService.createProposedPage({
      organizationId: ctx.organizationId,
      pagePath,
      title,
      content,
      source: 'AGENT_CORRECTION',
      correctionContext,
      createdBy: ctx.userId,
    });

    return {
      pageId: page.id,
      status: 'DRAFT',
      message: 'Proposed knowledge page created. An admin must approve it before agents can use it.',
    };
  },
});
