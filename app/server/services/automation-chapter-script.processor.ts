import { HumanMessage } from '@langchain/core/messages';
import mongoose from 'mongoose';
import { getLlm } from '../config/llm';
import { AutomationConfig } from '../models/automation-config';
import { AutomationSourcePageProcessed } from '../models/automation-source-page-processed';
import automationScriptRepository from '../repositories/automation-script.repository';
import { getS3ObjectBuffer } from './storage/s3';
import { logger } from './logging';
import type { ChapterScriptEventData } from 'shared/types/event-contracts';

const llm = getLlm();

async function summarizeChapter(chapterText: string, theme: string): Promise<string> {
  const prompt = `Summarize this chapter into concise key points for script writing.
Focus on: narrative flow, key ideas, key details, and useful examples.
Keep it factual and concise.

Ignore non-content/front-matter metadata unless it is central to the chapter's argument:
- author names and credentials
- publisher/imprint information
- ISBN/catalog numbers
- edition/printing/legal notices
- acknowledgments, copyright, dedication, table-of-contents style text

THEME LENS: ${theme || '(none)'}

CHAPTER TEXT:
---
${chapterText.substring(0, 60000)}
---

Return plain text only.`;

  const res = await llm.invoke([new HumanMessage(prompt)]);
  const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
  return content.trim();
}

async function writeChapterScript(summary: string, chapterTitle: string, theme: string): Promise<string> {
  const prompt = `Write a chapter-based horizontal video narration script.

Constraints:
- Plain text only (no markdown, no stage directions).
- 560 to 680 words total (target around 600).
- Cohesive condensed retelling of the chapter.
- Keep pacing natural for a 4-5 minute voiceover.
- Include a brief hook and a clear closing beat.
- Focus on substantive chapter content (core ideas, explanations, examples, implications).
- Do NOT include bibliographic or publication metadata unless directly relevant:
  author bios, university affiliations, publisher names, ISBN/catalog numbers, edition/printing details.
- Write as one continuous narration in normal prose.
- Do NOT use section labels or meta tags such as "Hook:", "Intro:", "Body:", "Closing beat:", "Conclusion:".
- Do NOT output commentary like "(Word count: ...)" or any other parenthetical production notes.

Chapter title: ${chapterTitle}
Theme guidance: ${theme || 'engaging and clear educational narration'}

SUMMARY TO EXPAND:
---
${summary}
---

Return only the final script body.`;

  const res = await llm.invoke([new HumanMessage(prompt)]);
  const content = typeof res.content === 'string' ? res.content : JSON.stringify(res.content);
  return content.trim();
}

export async function processChapterScriptMessage(data: ChapterScriptEventData): Promise<void> {
  const {
    automationConfigId,
    sourceUploadId,
    chapterNumber,
    chapterTitle,
    chapterText,
    chapterTextS3Key,
    startPage,
    userId
  } = data;

  const uploadOid = new mongoose.Types.ObjectId(sourceUploadId);
  const configOid = new mongoose.Types.ObjectId(automationConfigId);

  const already = await AutomationSourcePageProcessed.findOne({
    sourceUploadId: uploadOid,
    pageNumber: chapterNumber
  }).lean();
  if (already) {
    logger.info('Automation source chapter already processed, skipping', { sourceUploadId, chapterNumber });
    return;
  }

  await automationScriptRepository.deleteManyBySourceAndPage(sourceUploadId, startPage);

  const resolvedChapterText =
    chapterText ??
    (chapterTextS3Key ? (await getS3ObjectBuffer(chapterTextS3Key)).toString('utf8') : undefined);

  if (!resolvedChapterText) {
    throw new Error(`No chapter text available for source ${sourceUploadId} chapter ${chapterNumber}`);
  }

  logger.info('Processing chapter script message', {
    sourceUploadId,
    chapterNumber,
    usedS3Pointer: Boolean(chapterTextS3Key && !chapterText),
    chapterTextLength: resolvedChapterText.length
  });

  const summary = await summarizeChapter(resolvedChapterText, data.theme);
  const script = await writeChapterScript(summary, chapterTitle, data.theme);
  if (script) {
    const order = await automationScriptRepository.getNextOrder(automationConfigId);
    await automationScriptRepository.createMany([
      {
        automationConfigId: configOid,
        userId,
        topic: chapterTitle || `Chapter ${chapterNumber}`,
        script,
        sourceUploadId: uploadOid,
        sourcePageNumber: startPage,
        order
      }
    ]);
  }

  await AutomationSourcePageProcessed.create({
    sourceUploadId: uploadOid,
    pageNumber: chapterNumber,
    automationConfigId: configOid
  });

  await AutomationConfig.updateOne(
    { _id: configOid },
    {
      $inc: {
        'contentSettings.sources.$[s].processedChapters': 1,
        'contentSettings.sources.$[s].scriptCount': script ? 1 : 0
      }
    },
    { arrayFilters: [{ 's.uploadId': sourceUploadId }] }
  );

  const fresh = await AutomationConfig.findById(configOid).lean();
  const src = fresh?.contentSettings?.sources?.find((s: { uploadId?: string }) => s.uploadId === sourceUploadId);
  if (
    src &&
    typeof src.totalChapters === 'number' &&
    src.totalChapters > 0 &&
    typeof src.processedChapters === 'number' &&
    src.processedChapters >= src.totalChapters
  ) {
    await AutomationConfig.updateOne(
      { _id: configOid },
      { $set: { 'contentSettings.sources.$[s].status': 'completed', 'contentSettings.sources.$[s].error': '' } },
      { arrayFilters: [{ 's.uploadId': sourceUploadId }] }
    );
  }
}
