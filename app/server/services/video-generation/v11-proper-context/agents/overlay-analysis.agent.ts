import { configureDotenv } from '../../../../config/dotenv';
import { getLlm } from '../../../../config/llm';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { imageUrlToBase64 } from '../utils/to-base-64';
configureDotenv();

const llm = getLlm();

export const overlayAnalysisAgent = async ({
  script,
  brollThumbnailUrl,
  context
}: {
  script: string;
  brollThumbnailUrl: string;
  context: string;
}) => {
  let imageDataUrl = '';
  try {
    imageDataUrl = await imageUrlToBase64(brollThumbnailUrl);
  } catch {
    // If we can't provide a supported image, return a neutral score.
    return '0';
  }

  const systemMessage = new SystemMessage(
    'You are an expert at analyzing brolls for a video segment. I will give you a part of a segment that is covered by broll. I will provide the broll thumbnail url that shows what the broll is about. I will also include the context of the part of the video where this is from. Your task is to determine how appropriate the broll is for this part of the video. If the script is about japanese architecture, but you see english architecture, for example, that is not appropriate. Please respond with a number, either 0, 20, 40, 60, 80 or 100, where 0 is not appropriate, 20 is somewhat ok, 40 is ok, 60 is good, 80 is appropriate and 100 is very appropriate. Reply with the number only, and nothing else, no explanation, no formatting, no other text. Your answer will be used programatically.'
  );

  const humanMessage = new HumanMessage({
    content: [
      {
        type: 'text',
        text: `Script: ${script}\nContext: ${context}`
      },
      {
        type: 'image_url',
        image_url: { url: imageDataUrl }
      }
    ]
  });

  const response = await llm.invoke([systemMessage, humanMessage]);
  const responseText = typeof response.content === 'string' ? response.content : String(response.content);
  const match = responseText.match(/\b(0|20|40|60|80|100)\b/);
  return (match?.[1] ?? responseText).trim();
};
