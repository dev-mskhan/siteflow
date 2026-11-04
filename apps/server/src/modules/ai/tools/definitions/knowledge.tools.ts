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

// ── search_knowledge_base is registered in knowledge.rag.tools.ts (W3.2.5) ──
// That file is imported after the ingestion infrastructure is in place.
