import { HumanMessage } from '@langchain/core/messages';
import mongoose from 'mongoose';
import { getLlm } from '../config/llm';
import { logger } from './logging';
import { AutomationConfig } from '../models/automation-config';
import { AutomationSourcePageProcessed } from '../models/automation-source-page-processed';
import automationScriptRepository from '../repositories/automation-script.repository';
import type { AutomationSourcePageProcessingEventData } from 'shared/types/event-contracts';

const llm = getLlm();

function stripJsonFence(raw: string): string {
  let t = raw.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  return t.trim();
}

function parseTopicJson(raw: string): { topic: string; relevantExcerpt: string }[] {
  const text = stripJsonFence(raw);
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is { topic: string; relevantExcerpt: string } => {
        if (!x || typeof x !== 'object') return false;
        const o = x as Record<string, unknown>;
        return typeof o.topic === 'string';
      })
      .map(x => ({
        topic: x.topic,
        relevantExcerpt: typeof x.relevantExcerpt === 'string' ? x.relevantExcerpt : ''
      }));
  } catch {
    logger.warn('Failed to parse topic JSON from Grok', { preview: text.slice(0, 200) });
    return [];
  }
}

async function extractTopicsForPage(pageText: string, theme: string): Promise<{ topic: string; relevantExcerpt: string }[]> {
  const prompt = `You are an editor. Given PAGE TEXT and THEME, return a JSON array only (no markdown) of objects with keys "topic" and "relevantExcerpt".

The THEME is a lens: only include distinct video-worthy topics that relate to or can be framed within the THEME. Discard unrelated material.

Do NOT suggest topics for:
- title pages
- copyright/dedication/acknowledgment/front-matter pages
- table of contents pages
- chapter index/outline pages (pages that mainly list chapter names and where they appear)

If the page has no theme-relevant topics, return [].

PAGE TEXT:
---
${pageText.slice(0, 12000)}
---

THEME: ${theme || '(none — use general interest)'}`;

  const res = await llm.invoke([new HumanMessage(prompt)]);
  const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
  return parseTopicJson(content);
}

async function writeScriptForTopic(topic: string, excerpt: string, theme: string): Promise<string> {
  const prompt = `Write a short video narration script (plain text only, no stage directions, no annotations) based on:
Topic: ${topic}
Source excerpt: ${excerpt}
Style / theme guidance: ${theme || 'engaging, clear, for social video'}

Length requirement: 90-150 words total. Keep it concise enough for about a one-minute max voiceover.

Reply with only the script body, one flowing narration.`;

  const res = await llm.invoke([new HumanMessage(prompt)]);
  const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
  const trimmed = content.trim();
  return trimmed;
}

export async function processAutomationSourcePageMessage(
  data: AutomationSourcePageProcessingEventData
): Promise<void> {
  const {
    automationConfigId,
    sourceUploadId,
    pageNumber,
    pageText,
    theme,
    userId,
    totalPages: _totalPages
  } = data;

  const uploadOid = new mongoose.Types.ObjectId(sourceUploadId);
  const configOid = new mongoose.Types.ObjectId(automationConfigId);

  const already = await AutomationSourcePageProcessed.findOne({
    sourceUploadId: uploadOid,
    pageNumber
  }).lean();
  if (already) {
    logger.info('Automation source page already processed, skipping', { sourceUploadId, pageNumber });
    return;
  }

  await automationScriptRepository.deleteManyBySourceAndPage(sourceUploadId, pageNumber);

  const topics = await extractTopicsForPage(pageText, theme);
  const docs: Array<{
    automationConfigId: mongoose.Types.ObjectId;
    userId: string;
    topic: string;
    script: string;
    sourceUploadId: mongoose.Types.ObjectId;
    sourcePageNumber: number;
    order: number;
  }> = [];

  let orderBase = await automationScriptRepository.getNextOrder(automationConfigId);
  for (const row of topics) {
    const script = await writeScriptForTopic(row.topic, row.relevantExcerpt, theme);
    if (!script) continue;
    docs.push({
      automationConfigId: configOid,
      userId,
      topic: row.topic,
      script,
      sourceUploadId: uploadOid,
      sourcePageNumber: pageNumber,
      order: orderBase++
    });
  }

  if (docs.length > 0) {
    await automationScriptRepository.createMany(docs);
  }

  await AutomationSourcePageProcessed.create({
    sourceUploadId: uploadOid,
    pageNumber,
    automationConfigId: configOid
  });

  await AutomationConfig.updateOne(
    { _id: configOid },
    {
      $inc: {
        'contentSettings.sources.$[s].processedPages': 1,
        'contentSettings.sources.$[s].scriptCount': docs.length
      }
    },
    { arrayFilters: [{ 's.uploadId': sourceUploadId }] }
  );

  const fresh = await AutomationConfig.findById(configOid).lean();
  const src = fresh?.contentSettings?.sources?.find((s: { uploadId?: string }) => s.uploadId === sourceUploadId);
  if (
    src &&
    typeof src.totalPages === 'number' &&
    src.totalPages > 0 &&
    typeof src.processedPages === 'number' &&
    src.processedPages >= src.totalPages
  ) {
    await AutomationConfig.updateOne(
      { _id: configOid },
      { $set: { 'contentSettings.sources.$[s].status': 'completed', 'contentSettings.sources.$[s].error': '' } },
      { arrayFilters: [{ 's.uploadId': sourceUploadId }] }
    );
  }
}
