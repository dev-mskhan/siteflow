// apps/server/src/modules/ai/ingestion/chunker.ts
//
// Structure-aware text chunker for the RAG ingestion pipeline.
// Splits on heading/section boundaries, not fixed character counts.
// Prepends the heading path to every chunk for richer embeddings.

export interface TextChunk {
  content: string;
  chunkIndex: number;
  pageReference: string | null;
}

const TARGET_MIN = 400;
const TARGET_MAX = 900;
const OVERLAP_SENTENCES = 2;

// ── Heading detection ──────────────────────────────────────────────────────────
// Handles Markdown #/##/### and common plain-text heading patterns.

const HEADING_RE = /^(#{1,4})\s+(.+)$/m;
const SECTION_SPLIT_RE = /^#{1,4}\s+.+$/m;

function splitIntoSections(text: string): Array<{ heading: string; body: string }> {
  const lines = text.split('\n');
  const sections: Array<{ heading: string; body: string }> = [];
  let currentHeading = '';
  let bodyLines: string[] = [];

  for (const line of lines) {
    if (HEADING_RE.test(line)) {
      if (bodyLines.length > 0 || currentHeading) {
        sections.push({ heading: currentHeading, body: bodyLines.join('\n').trim() });
      }
      currentHeading = line.trim();
      bodyLines = [];
    } else {
      bodyLines.push(line);
    }
  }
  if (bodyLines.length > 0 || currentHeading) {
    sections.push({ heading: currentHeading, body: bodyLines.join('\n').trim() });
  }
  return sections.filter((s) => s.heading || s.body);
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function sentenceSuffix(text: string, count: number): string {
  // Return approximately `count` sentences from the end of `text`
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.slice(-count).join(' ').trim();
}

/**
 * Chunks a plain-text document into context-rich segments.
 *
 * Algorithm:
 * 1. Split on Markdown headings → sections
 * 2. Within each section, split on paragraph breaks
 * 3. Accumulate paragraphs until TARGET_MAX chars, emit chunk
 * 4. Prepend heading path to each chunk for embedding richness
 * 5. Add sentence overlap at chunk boundaries
 */
export function chunkText(text: string, pageRef?: string | null): TextChunk[] {
  if (!text || text.trim().length === 0) return [];

  const sections = splitIntoSections(text);
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  let prevSuffix = '';

  for (const section of sections) {
    const contextPrefix = section.heading ? `[${section.heading}]\n` : '';
    const paragraphs = splitIntoParagraphs(section.body || section.heading);

    if (paragraphs.length === 0) continue;

    let buffer = prevSuffix ? `${prevSuffix}\n\n` : '';

    for (const para of paragraphs) {
      const candidate = buffer + para;

      if (candidate.length > TARGET_MAX && buffer.trim().length >= TARGET_MIN) {
        // Emit current buffer as a chunk
        const content = `${contextPrefix}${buffer.trim()}`;
        chunks.push({ content, chunkIndex, pageReference: pageRef ?? null });
        chunkIndex++;
        prevSuffix = sentenceSuffix(buffer.trim(), OVERLAP_SENTENCES);
        buffer = `${prevSuffix ? prevSuffix + '\n\n' : ''}${para}`;
      } else {
        buffer = candidate + '\n\n';
      }
    }

    // Flush remaining buffer
    if (buffer.trim().length > 0) {
      const content = `${contextPrefix}${buffer.trim()}`;
      if (content.length >= 20) {
        chunks.push({ content, chunkIndex, pageReference: pageRef ?? null });
        chunkIndex++;
        prevSuffix = sentenceSuffix(buffer.trim(), OVERLAP_SENTENCES);
      }
    }
  }

  return chunks;
}
