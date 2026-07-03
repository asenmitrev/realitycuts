import { HumanMessage } from '@langchain/core/messages';
import mongoose from 'mongoose';
import { getLlm } from '../config/llm';
import { AutomationConfig } from '../models/automation-config';
import { getS3ObjectBuffer, putS3ObjectString } from './storage/s3';
import { enqueueChapterScriptTask } from './task-queue';
import { logger } from './logging';
import type { ChapterDetectionEventData } from 'shared/types/event-contracts';

const llm = getLlm();

type ChapterRange = {
  title: string;
  startPage: number;
  endPage: number;
};

type Chunk = {
  startPage: number;
  endPage: number;
  pageSnippets: Array<{
    pageNumber: number;
    snippet: string;
  }>;
};

const CHUNK_MAX_CHARS = 16000;
const CHUNK_MAX_PAGES = 30;
const CHUNK_OVERLAP_PAGES = 1;
const CHAPTER_TEXT_INLINE_LIMIT_BYTES = 180000;

function stripJsonFence(raw: string): string {
  let t = raw.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return t.trim();
}

function looksLikeChapterStart(pageText: string): string | null {
  const preview = pageText.slice(0, 800).trim();
  if (!preview) return null;

  const patterns = [
    /^(chapter\s+\d+\b[^\n]*)/im,
    /^(chapter\s+[ivxlcdm]+\b[^\n]*)/im,
    /^(chapter\s+(one|two|three|four|five|six|seven|eight|nine|ten)\b[^\n]*)/im,
    /^(part\s+\d+\b[^\n]*)/im,
    /^(part\s+[ivxlcdm]+\b[^\n]*)/im
  ];

  for (const pattern of patterns) {
    const match = preview.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function detectChaptersStructural(pages: string[]): ChapterRange[] {
  const starts: Array<{ page: number; title: string }> = [];
  for (let i = 0; i < pages.length; i++) {
    const title = looksLikeChapterStart(pages[i] || '');
    if (title) starts.push({ page: i + 1, title });
  }

  if (starts.length === 0) return [];
  if (starts[0].page !== 1) {
    starts.unshift({ page: 1, title: 'Chapter 1' });
  }

  const ranges: ChapterRange[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].page;
    const end = i + 1 < starts.length ? starts[i + 1].page - 1 : pages.length;
    if (end >= start) {
      ranges.push({
        title: starts[i].title || `Chapter ${i + 1}`,
        startPage: start,
        endPage: end
      });
    }
  }
  return ranges;
}

function parseChapterRanges(raw: string, totalPages: number): ChapterRange[] {
  const text = stripJsonFence(raw);
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((row): ChapterRange | null => {
        if (!row || typeof row !== 'object') return null;
        const item = row as Record<string, unknown>;
        const startPage = Number(item.startPage);
        const endPage = Number(item.endPage);
        if (!Number.isFinite(startPage) || !Number.isFinite(endPage)) return null;
        const safeStart = Math.max(1, Math.min(totalPages, Math.floor(startPage)));
        const safeEnd = Math.max(safeStart, Math.min(totalPages, Math.floor(endPage)));
        const title = typeof item.title === 'string' && item.title.trim() ? item.title.trim() : `Chapter ${safeStart}`;
        return { title, startPage: safeStart, endPage: safeEnd };
      })
      .filter((row): row is ChapterRange => Boolean(row))
      .sort((a, b) => a.startPage - b.startPage);
    return normalized;
  } catch {
    logger.warn('Failed to parse chapter range JSON', { preview: text.slice(0, 200) });
    return [];
  }
}

async function detectChaptersWithLLM(pages: string[], theme: string): Promise<ChapterRange[]> {
  const chunks = buildPageChunks(pages, CHUNK_MAX_CHARS, CHUNK_MAX_PAGES, CHUNK_OVERLAP_PAGES);
  logger.info('Chunked chapter detection started', { pageCount: pages.length, chunkCount: chunks.length });

  const merged: ChapterRange[] = [];
  let parseFailures = 0;

  for (const chunk of chunks) {
    const firstAttempt = await detectChunkRangesWithLLM(chunk, pages.length, theme, false);
    if (firstAttempt.length > 0) {
      merged.push(...firstAttempt);
      continue;
    }

    parseFailures += 1;
    const retryAttempt = await detectChunkRangesWithLLM(chunk, pages.length, theme, true);
    if (retryAttempt.length > 0) {
      merged.push(...retryAttempt);
    } else {
      parseFailures += 1;
    }
  }

  logger.info('Chunked chapter detection completed', {
    pageCount: pages.length,
    chunkCount: chunks.length,
    parseFailures,
    rawRangeCount: merged.length
  });

  if (merged.length === 0) {
    logger.warn('Chunked chapter detection produced no ranges, using deterministic fallback', {
      pageCount: pages.length,
      chunkCount: chunks.length,
      parseFailures
    });
    return buildDeterministicFallbackRanges(pages.length);
  }

  return mergeRanges(merged, pages.length);
}

function normalizeRanges(ranges: ChapterRange[], totalPages: number): ChapterRange[] {
  if (ranges.length === 0) {
    return [{ title: 'Chapter 1', startPage: 1, endPage: totalPages }];
  }

  const out: ChapterRange[] = [];
  let cursor = 1;
  for (let i = 0; i < ranges.length; i++) {
    const raw = ranges[i];
    const normalizedStart = Math.max(1, Math.min(totalPages, raw.startPage));
    if (normalizedStart > cursor) {
      out.push({
        title: `Section ${out.length + 1}`,
        startPage: cursor,
        endPage: normalizedStart - 1
      });
      cursor = normalizedStart;
    }

    const startPage = Math.max(cursor, normalizedStart);
    const endPage = Math.max(startPage, Math.min(totalPages, raw.endPage));
    out.push({
      title: raw.title || `Chapter ${i + 1}`,
      startPage,
      endPage
    });
    cursor = endPage + 1;
    if (cursor > totalPages) break;
  }

  if (cursor <= totalPages) {
    out.push({
      title: `Chapter ${out.length + 1}`,
      startPage: cursor,
      endPage: totalPages
    });
  }

  return out;
}

function chapterTextForRange(pages: string[], startPage: number, endPage: number): string {
  const chunks: string[] = [];
  for (let p = startPage; p <= endPage; p++) {
    chunks.push(pages[p - 1] || '');
  }
  return chunks.join('\n\n').trim();
}

function buildPageChunks(
  pages: string[],
  maxCharsPerChunk: number,
  maxPagesPerChunk: number,
  overlapPages: number
): Chunk[] {
  const chunks: Chunk[] = [];
  let cursor = 0;

  while (cursor < pages.length) {
    const start = cursor;
    const pageSnippets: Chunk['pageSnippets'] = [];
    let charCount = 0;
    let pageCount = 0;

    while (cursor < pages.length) {
      const snippet = (pages[cursor] || '').replace(/\s+/g, ' ').trim().slice(0, 520);
      const nextCount = charCount + snippet.length;
      if (pageCount > 0 && (pageCount >= maxPagesPerChunk || nextCount > maxCharsPerChunk)) {
        break;
      }
      pageSnippets.push({
        pageNumber: cursor + 1,
        snippet
      });
      charCount = nextCount;
      pageCount += 1;
      cursor += 1;
    }

    if (pageSnippets.length === 0) {
      cursor += 1;
      continue;
    }

    chunks.push({
      startPage: start + 1,
      endPage: start + pageSnippets.length,
      pageSnippets
    });

    if (cursor < pages.length) {
      cursor = Math.max(start + 1, cursor - overlapPages);
    }
  }

  return chunks;
}

async function detectChunkRangesWithLLM(
  chunk: Chunk,
  totalPages: number,
  theme: string,
  strictJson: boolean
): Promise<ChapterRange[]> {
  const strictInstruction = strictJson
    ? 'Output MUST be valid JSON only. No prose, no markdown, no trailing commas.'
    : 'Return ONLY JSON array (no markdown).';

  const prompt = `You are segmenting a PDF into chapter-like sections.
${strictInstruction}
Output objects: { "title": string, "startPage": number, "endPage": number }.

Rules:
- Use absolute page numbers.
- Only produce ranges within pages ${chunk.startPage}..${chunk.endPage}.
- Prefer natural chapter boundaries from headings/titles.
- If no explicit chapters exist, segment thematically.
- Ranges should be non-overlapping.
- Keep titles concise.
- Do not create standalone sections for front matter unless unavoidable:
  title/copyright/dedication/acknowledgments, publisher metadata, ISBN/catalog pages, table of contents.

THEME LENS: ${theme || '(none)'}
TOTAL PDF PAGES: ${totalPages}
CURRENT CHUNK: ${chunk.startPage}-${chunk.endPage}

PAGE SNIPPETS:
${JSON.stringify(chunk.pageSnippets)}`;

  const res = await llm.invoke([new HumanMessage(prompt)]);
  const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
  return parseChapterRanges(content, totalPages).filter(
    range => range.startPage >= chunk.startPage && range.endPage <= chunk.endPage
  );
}

function mergeRanges(ranges: ChapterRange[], totalPages: number): ChapterRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a.startPage - b.startPage || a.endPage - b.endPage);
  const merged: ChapterRange[] = [];

  for (const range of sorted) {
    if (merged.length === 0) {
      merged.push(range);
      continue;
    }
    const prev = merged[merged.length - 1];
    const overlapsOrAdjacent = range.startPage <= prev.endPage + 1;
    if (overlapsOrAdjacent) {
      prev.endPage = Math.max(prev.endPage, range.endPage);
      if (prev.title.startsWith('Chapter') && !range.title.startsWith('Chapter')) {
        prev.title = range.title;
      }
    } else {
      merged.push(range);
    }
  }

  return merged
    .map(r => ({
      title: r.title,
      startPage: Math.max(1, Math.min(totalPages, r.startPage)),
      endPage: Math.max(1, Math.min(totalPages, r.endPage))
    }))
    .filter(r => r.endPage >= r.startPage);
}

function buildDeterministicFallbackRanges(totalPages: number): ChapterRange[] {
  const sectionCount = Math.min(12, Math.max(1, Math.ceil(totalPages / 25)));
  const pagesPerSection = Math.ceil(totalPages / sectionCount);
  const ranges: ChapterRange[] = [];
  let startPage = 1;
  let section = 1;
  while (startPage <= totalPages) {
    const endPage = Math.min(totalPages, startPage + pagesPerSection - 1);
    ranges.push({
      title: `Section ${section}`,
      startPage,
      endPage
    });
    startPage = endPage + 1;
    section += 1;
  }
  return ranges;
}

export async function processChapterDetectionMessage(data: ChapterDetectionEventData): Promise<void> {
  const { automationConfigId, sourceUploadId, pageTextsS3Key, theme, userId } = data;
  const configOid = new mongoose.Types.ObjectId(automationConfigId);

  const raw = await getS3ObjectBuffer(pageTextsS3Key);
  const pages = JSON.parse(raw.toString('utf8')) as string[];
  logger.info('Processing chapter detection message', {
    automationConfigId,
    sourceUploadId,
    pageCount: Array.isArray(pages) ? pages.length : 0
  });
  if (!Array.isArray(pages) || pages.length === 0) {
    await AutomationConfig.updateOne(
      { _id: configOid },
      { $set: { 'contentSettings.sources.$[s].status': 'completed', 'contentSettings.sources.$[s].error': '' } },
      { arrayFilters: [{ 's.uploadId': sourceUploadId }] }
    );
    return;
  }

  const structural = detectChaptersStructural(pages);
  const llmRanges = structural.length > 0 ? structural : await detectChaptersWithLLM(pages, theme);
  const ranges = normalizeRanges(llmRanges, pages.length);

  await AutomationConfig.updateOne(
    { _id: configOid },
    {
      $set: {
        'contentSettings.sources.$[s].totalChapters': ranges.length,
        'contentSettings.sources.$[s].processedChapters': 0,
        'contentSettings.sources.$[s].status': 'processing',
        'contentSettings.sources.$[s].error': ''
      }
    },
    { arrayFilters: [{ 's.uploadId': sourceUploadId }] }
  );

  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i];
    const chapterText = chapterTextForRange(pages, range.startPage, range.endPage);
    const chapterTextBytes = Buffer.byteLength(chapterText, 'utf8');
    const chapterTextS3Key = `users/${userId}/automation-sources/${automationConfigId}/chapter-texts/${sourceUploadId}-${i + 1}.txt`;
    let chapterTextInline: string | undefined = chapterText;

    if (chapterTextBytes > CHAPTER_TEXT_INLINE_LIMIT_BYTES) {
      await putS3ObjectString(chapterTextS3Key, chapterText, 'text/plain');
      chapterTextInline = undefined;
    }

    await enqueueChapterScriptTask({
      version: '1.0.0',
      automationConfigId,
      sourceUploadId,
      chapterNumber: i + 1,
      chapterTitle: range.title || `Chapter ${i + 1}`,
      chapterText: chapterTextInline,
      chapterTextS3Key: chapterTextInline ? undefined : chapterTextS3Key,
      startPage: range.startPage,
      endPage: range.endPage,
      theme: theme || '',
      userId,
      totalChapters: ranges.length
    });
  }
}
