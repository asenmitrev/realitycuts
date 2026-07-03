import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { getLlm } from '../../../../config/llm';
import type { ScriptTheme } from '../utils/derive-script-theme';

const llm = getLlm();

const outputParser = new StringOutputParser();

const DEFAULT_PALETTE =
  'use a warm, coffee-shop inspired palette (warm linen #E8DCC8, soft sand #D4C5A9, muted terracotta #C4622D, dusty teal #7AADA8, and muted navy #3D5068), flat graphic design with clean silhouettes, and a light airy feel grounded by earthy warm tones. Use the linen/sand as dominant background colors with terracotta and teal as accent pops. Avoid harsh blacks—favor dark brown #3D2B1F for text and outlines. Keep edges crisp and fills solid for a clean, editorial infographic feel.';

function buildSystemPrompt(duration: number, scriptTheme?: ScriptTheme): string {
  const aestheticLine = scriptTheme
    ? `Apply a distinctive aesthetic: use the following color palette exactly. Primary background: ${scriptTheme.primaryColor}. Secondary background: ${scriptTheme.secondaryColor}. Accent colors: ${scriptTheme.accentColor1} and ${scriptTheme.accentColor2}. Text and outlines: ${scriptTheme.textColor}. Style: ${scriptTheme.styleDescription} Keep edges crisp and fills solid for a clean, editorial infographic feel.`
    : `Apply a distinctive aesthetic: ${DEFAULT_PALETTE}`;

  return `You are an expert creative coder. Generate a single, self-contained HTML file that creates a visually stunning animated infographic for the given data points and script.

STRICT REQUIREMENTS:
- Output ONLY valid HTML – no markdown, no code fences, no explanation, just the raw HTML document.
- The animation must start immediately when the page loads (no user interaction needed).
- Use CSS animations, SVG animations, and/or HTML5 Canvas with JavaScript – whatever best visualizes the data.
- All assets must be inline (no external URLs, no CDN links, no Google Fonts).
- The page background should fill the entire viewport (use width:100vw; height:100vh or 100%).
- The animation must fill the full ${duration}-second duration. Time all keyframes and animations to complete within ${duration}s.
- Target viewport: 1920×1080px.
- ${aestheticLine}
- Focus on data visualization: bar charts, pie charts, counters, progress bars, or bold typography for key numbers. Animate numbers counting up, bars filling, or elements fading in.
- Use smooth motion and high visual quality.
- Avoid using icon fonts or external icon sets; use simple SVG shapes or CSS if needed.
- DO NOT include titles or watermarks unless the script explicitly asks for them. The script sentence may be shown as a short caption if it fits the design.
- The HTML document must have exactly this meta tag: <meta name="animation-ready" content="true"> (so the renderer can sync frame capture).`;
}

const chatPrompt = ChatPromptTemplate.fromMessages<{
  systemPrompt: string;
  script: string;
  context: string;
  dataPoints: string;
  duration: number;
}>([
  ['system', '{systemPrompt}'],
  [
    'human',
    `Create an animated infographic for this sentence and data.

Script sentence (what the voice is saying): {script}

Surrounding context: {context}

Data points to visualize (numbers, stats, facts): {dataPoints}

Duration: {duration} seconds. All animations must be timed to run over exactly this duration.`
  ]
]);

export async function invoke(args: {
  script: string;
  context: string;
  dataPoints: string[];
  duration: number;
  scriptTheme?: ScriptTheme;
}): Promise<string> {
  const systemPrompt = buildSystemPrompt(args.duration, args.scriptTheme);
  const raw = await chatPrompt.pipe(llm).pipe(outputParser).invoke({
    systemPrompt,
    script: args.script,
    context: args.context,
    dataPoints: args.dataPoints.join(', '),
    duration: args.duration
  });

  return raw
    .trim()
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
}

export const svgInfographicAgent = { invoke };
