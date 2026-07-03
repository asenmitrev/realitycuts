import { ChatPromptTemplate } from '@langchain/core/prompts';
import { SystemMessage } from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getLlm } from '../config/llm';
import { logger } from '../services/logging';

export interface MusicPromptRequest {
  transcript: string;
  title?: string;
  duration?: number;
  videoType?: 'educational' | 'entertainment' | 'business' | 'promotional' | 'narrative' | 'other';
}

export interface MusicPromptResponse {
  prompt: string;
  reasoning: string;
}

const llm = getLlm();

const outputParser = new StringOutputParser();

const chatPrompt = ChatPromptTemplate.fromMessages([
  new SystemMessage(
    `You are a professional music director and composer AI specializing in creating instrumental background music for videos. Your task is to analyze video content and generate precise, effective prompts for AI music generation.

IMPORTANT GUIDELINES:
- Music must be INSTRUMENTAL ONLY - no vocals, lyrics, or spoken words
- Generate exactly 3-4 sentences for the music prompt
- Focus on mood, atmosphere, energy level, and musical style
- Consider the content's emotional arc and pacing
- Suggest specific instruments, tempo, and musical characteristics
- Avoid any references to vocals, singing, or lyrical content

ANALYSIS FRAMEWORK:
1. Content Analysis: What is the video about? What's the main theme/message?
2. Emotional Tone: What emotions should the music evoke? (calm, energetic, inspiring, dramatic, etc.)
3. Pacing: Is the content fast-paced or contemplative? Does it build up or remain steady?
4. Musical Style: What genre/style would complement this content? (cinematic, ambient, corporate, upbeat, etc.)
5. Instrumentation: What instruments would work best? (piano, strings, electronic, acoustic guitar, etc.)

RESPONSE FORMAT:
Respond with exactly this format:
PROMPT: [Your 3-4 sentence instrumental music prompt]
REASONING: [Brief explanation of your musical choices]

EXAMPLE OUTPUTS:
PROMPT: Uplifting instrumental track with gentle acoustic guitar and soft piano melodies, building gradually with light percussion and warm strings. The music should evoke inspiration and hope with a moderate tempo around 100-110 BPM. Subtle orchestral swells add emotional depth without overwhelming the narration.
REASONING: The educational content requires music that supports learning without distraction, so I chose gentle instruments with a moderate tempo to maintain focus while adding emotional engagement.

PROMPT: Energetic electronic instrumental with driving synthesizers and rhythmic beats, perfect for dynamic content. The track should maintain high energy with layered electronic elements and a tempo around 120-130 BPM. Modern production style with crisp percussion and engaging melodic hooks.
REASONING: The fast-paced promotional content needs energetic music to match the excitement and urgency, so I selected electronic elements with a higher tempo to create momentum and engagement.`
  ),
  [
    'human',
    `Analyze this video content and create an instrumental music prompt:

TITLE: {title}
DURATION: {duration}
VIDEO TYPE: {videoType}

TRANSCRIPT:
{transcript}`
  ]
]);

const agent = chatPrompt.pipe(llm).pipe(outputParser);

/**
 * Generates an optimized instrumental music prompt based on video content analysis
 */
export const generateMusicPrompt = async ({
  transcript,
  title,
  duration,
  videoType = 'other'
}: MusicPromptRequest): Promise<MusicPromptResponse> => {
  try {
    const durationText = duration ? `${Math.round(duration)} seconds` : 'Not specified';

    const result = await agent.invoke({
      title: title || 'Untitled Video',
      duration: durationText,
      videoType,
      transcript
    });

    // Parse the response
    const promptMatch = result.match(/PROMPT:\s*([\s\S]*?)(?=\nREASONING:|$)/);
    const reasoningMatch = result.match(/REASONING:\s*([\s\S]*)$/);

    const prompt = promptMatch ? promptMatch[1].trim() : generateFallbackPrompt(transcript, videoType, duration);
    const reasoning = reasoningMatch ? reasoningMatch[1].trim() : 'AI-generated musical analysis based on content.';

    return {
      prompt,
      reasoning
    };
  } catch (error) {
    logger.error('Error generating music prompt with Claude:', { error: error?.toString() });

    // Fallback prompt based on basic analysis
    const fallbackPrompt = generateFallbackPrompt(transcript, videoType, duration);

    return {
      prompt: fallbackPrompt,
      reasoning: 'Fallback prompt generated due to AI service unavailability.'
    };
  }
};

/**
 * Generates a basic fallback prompt when the AI service is unavailable
 */
function generateFallbackPrompt(transcript: string, videoType: string, _duration?: number): string {
  const words = transcript.toLowerCase();

  // Basic mood detection
  const isEnergetic = /energy|exciting|dynamic|fast|quick|action|intense/.test(words);
  const isCalm = /calm|peaceful|relax|gentle|soft|quiet|meditat/.test(words);
  const isInspirational = /inspir|motiv|achiev|success|goal|dream|hope/.test(words);
  const isBusiness = /business|corporate|professional|meeting|strategy/.test(words);

  if (isEnergetic) {
    return 'Upbeat instrumental track with driving rhythm and energetic melodies, featuring electronic beats and synthesizers. The music should maintain high energy with a tempo around 120-130 BPM. Modern production style with engaging hooks and dynamic progression.';
  } else if (isCalm) {
    return 'Gentle instrumental music with soft piano melodies and warm ambient textures, creating a peaceful and contemplative atmosphere. The track should flow smoothly with minimal percussion and a slow to moderate tempo around 70-90 BPM. Ethereal pads and subtle strings add depth.';
  } else if (isInspirational) {
    return 'Inspiring instrumental composition with uplifting piano and orchestral elements, building gradually to create emotional impact. The music should evoke hope and determination with a moderate tempo around 100-110 BPM. Subtle crescendos and warm string arrangements enhance the motivational feeling.';
  } else if (isBusiness || videoType === 'business') {
    return 'Professional instrumental background music with clean acoustic guitar and subtle percussion, designed for corporate content. The track should maintain a confident and trustworthy mood with a steady tempo around 95-105 BPM. Light orchestration and modern production create sophistication.';
  } else {
    return 'Versatile instrumental background music with balanced melodies and gentle harmonies, suitable for various content types. The track features acoustic and electronic elements with a moderate tempo around 100 BPM. Clean production with subtle dynamics and engaging musical phrases.';
  }
}

/**
 * Quick analysis function to determine basic video characteristics
 */
export const analyzeVideoContent = (
  transcript: string,
  title?: string
): {
  suggestedVideoType: MusicPromptRequest['videoType'];
  estimatedMood: string;
  confidence: number;
} => {
  const words = transcript.toLowerCase();
  const titleWords = title?.toLowerCase() || '';
  const allText = `${words} ${titleWords}`;

  // Type detection
  let suggestedVideoType: MusicPromptRequest['videoType'] = 'other';

  if (/learn|teach|educat|explain|understand|lesson|tutorial/.test(allText)) {
    suggestedVideoType = 'educational';
  } else if (/business|corporate|company|meeting|strategy|professional/.test(allText)) {
    suggestedVideoType = 'business';
  } else if (/story|narrative|journey|adventure|character/.test(allText)) {
    suggestedVideoType = 'narrative';
  } else if (/fun|funny|entertainment|laugh|enjoy|game/.test(allText)) {
    suggestedVideoType = 'entertainment';
  } else if (/product|service|brand|buy|purchase|offer/.test(allText)) {
    suggestedVideoType = 'promotional';
  }

  // Mood detection
  let estimatedMood = 'neutral';
  if (/energy|exciting|dynamic|action|intense/.test(allText)) {
    estimatedMood = 'energetic';
  } else if (/calm|peaceful|relax|gentle|soft/.test(allText)) {
    estimatedMood = 'calm';
  } else if (/inspir|motiv|success|achieve/.test(allText)) {
    estimatedMood = 'inspirational';
  } else if (/serious|important|critical|urgent/.test(allText)) {
    estimatedMood = 'serious';
  }

  // Simple confidence calculation based on keyword matches
  const confidence = Math.min(0.9, Math.max(0.3, transcript.length / 1000));

  return {
    suggestedVideoType,
    estimatedMood,
    confidence
  };
};
