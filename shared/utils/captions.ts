import Color from 'color';
import { VideoMetadata, CaptionSettings, WordBase, Line } from '../types';

export const FONT_SIZE_VERTICAL = 96;
export const FONT_SIZE_HORIZONTAL = 56;

export function getFontSize(dimensions: { width: number; height: number }) {
  const isVertical = dimensions.width < dimensions.height;
  const fontScale = isVertical ? dimensions.width / 1080 : dimensions.width / 1920;
  const fontSize = (isVertical ? FONT_SIZE_VERTICAL : FONT_SIZE_HORIZONTAL) * fontScale;
  return fontSize;
}

export function getTextStrokeWidth(strokeValue: number, dimensions: { width: number; height: number }) {
  const isVertical = dimensions.width < dimensions.height;
  const fontScale = isVertical ? dimensions.width / 1080 : dimensions.width / 1920;
  return strokeValue * fontScale;
}

export function getCharactersPerLine(
  dimensions: { width: number; height: number },
  subtitleSettings?: CaptionSettings
) {
  const fontSize = getFontSize(dimensions);
  const charactersPerLine = Math.floor(
    (dimensions.width * (subtitleSettings?.isUppercase ? 0.75 : 0.85)) / (fontSize * 0.55)
  );
  return charactersPerLine;
}

export function getSrtFileString({
  videoMetadata,
  transcript
}: {
  videoMetadata: VideoMetadata;
  transcript: WordBase[];
}) {
  const dimensions = {
    width: videoMetadata.streams[0]?.width ?? 1080,
    height: videoMetadata.streams[0]?.height ?? 1920
  };
  const lines = getLinesFromTranscript(transcript, dimensions);

  return lines
    .map((line, index) => {
      const lineContent = line.content.map(word => word.punctuated_word).join(' ');
      return `${index + 1}
${secondsToTimestamp(line.content[0].start, true)} --> ${secondsToTimestamp(
        line.content[line.content.length - 1].end,
        true
      )}
${lineContent}
`;
    })
    .join('\n\n');
}

export function getAssFileString({
  videoMetadata,
  transcript,
  subtitleSettings,
  isVertical,
  width,
  height
}: {
  width?: number;
  height?: number;
  isVertical?: boolean;
  videoMetadata: VideoMetadata;
  transcript: WordBase[];
  subtitleSettings: CaptionSettings;
}) {
  const dimensions = {
    width: width ?? videoMetadata.streams[0]?.width ?? 1080,
    height: height ?? videoMetadata.streams[0]?.height ?? 1920
  };
  const isVerticall = isVertical || dimensions.width < dimensions.height;

  const lines = getLinesFromTranscript(transcript, dimensions, subtitleSettings);
  const settings: CaptionSettings = {
    ...subtitleSettings,
    marginV: Math.floor((isVerticall ? 1920 : 1080) * subtitleSettings.marginV) / 100
  };
  let verticalFontSize = settings.verticalFontSize ?? settings.fontSize ?? FONT_SIZE_HORIZONTAL;
  let horizontalFontSize = settings.fontSize ?? FONT_SIZE_HORIZONTAL;
  const fontSize = isVerticall ? verticalFontSize : horizontalFontSize;
  const horizontalActiveWordFontSize = settings.activeWordFontSize ?? fontSize;
  const verticalActiveWordFontSize = settings.verticalActiveWordFontSize ?? settings.activeWordFontSize ?? fontSize;
  const activeWordFontSize = isVerticall ? verticalActiveWordFontSize : horizontalActiveWordFontSize;

  let assFile = `[Script Info]
Title: Example ASS Subtitles
ScriptType: v4.00+
WrapStyle: 0
PlayResX: ${isVerticall ? 1080 : 1920}
PlayResY: ${isVerticall ? 1920 : 1080}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${subtitleSettings.fontFamily ?? 'Roboto'},${fontSize},&${convertToARGBString(
    settings.primaryColor
  )},&HF0000000,&${convertToARGBString(settings.outlineColor)},&H64000000,0,0,0,0,100,100,${
    settings.letterSpacing ?? 0
  },0,1,${settings.outlineWidth},${settings.shadow ?? 0},2,50,50,${settings.marginV},1
${
  settings.type === 'WORD_BACKGROUND'
    ? `Style: Background,${subtitleSettings.fontFamily ?? 'Roboto'},${activeWordFontSize},&${convertToARGBString(
        settings.highlightedWordColor
      )},&HF0000000,&${convertToARGBString(
        settings.backgroundColor ?? settings.outlineColor
      )},&H64000000,0,0,0,0,100,100,${settings.letterSpacing ?? 0},0,3,${settings.outlineWidth},${
        settings.shadow ?? 0
      },2,50,50,${settings.marginV},1 `
    : ''
}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  let numLines = parseInt(settings.numberOfLines?.toString() ?? '1');
  const groupedLines: Line[][] = [];
  if (numLines <= 0) {
    numLines = 1;
  }
  for (let i = 0; i < lines.length; i += numLines) {
    const chunk = lines.slice(i, i + numLines);
    groupedLines.push(chunk);
  }

  groupedLines.forEach(lns => {
    const line: Line = {
      content: [],
      start: lns[0]?.start,
      end: lns[lns.length - 1]?.end
    };

    lns.forEach((l, lineIndex) => {
      line.content.push(...l.content);
      if (lineIndex < lns.length - 1) {
        line.content.push({
          word: '\\N',
          punctuated_word: '\\N',
          start: l.end,
          end: l.end,
          isLineBreak: true
        } as WordBase & { isLineBreak: boolean });
      }
    });

    let dialogueString = `Dialogue: 0,${secondsToTimestamp(line.start)},${secondsToTimestamp(
      line.end
    )},Default,,0,0,0,, `;
    if (settings.type === 'WORD_BACKGROUND') {
      dialogueString = '';
    }
    const content = line.content.filter(
      word => word.punctuated_word !== ' ' && word.punctuated_word !== '-' && !/^\s+$/.test(word.punctuated_word || '')
    );

    content.forEach((word, index) => {
      if ((word as any).isLineBreak) {
        dialogueString += '\\N';
        return;
      }

      if (settings.type === 'WORD_HIGHLIGHT') {
        dialogueString += getWordHighlightAssString(word, line, settings, isVerticall, index);
      } else if (settings.type === 'WORD_APPEAR') {
        dialogueString += getWordAppearAssString(word, line, settings, isVerticall, index);
      } else if (settings.type === 'WORD_BACKGROUND') {
        dialogueString += getWordBackgroundAssString(word, line, settings, isVerticall, index);
      }
    });
    assFile += dialogueString + `\n`;
  });
  return assFile;
}

export function getLinesFromTranscript(
  words: WordBase[],
  dimensions: { width: number; height: number },
  subtitleSettings?: CaptionSettings
) {
  const charactersPerLine =
    subtitleSettings?.maxCharactersPerLine ?? getCharactersPerLine(dimensions, subtitleSettings);
  const { sentences } = words.reduce<{
    sentences: WordBase[][];
    currentSentence: WordBase[];
  }>(
    (acc, word, index, array) => {
      const realWord = word.punctuated_word ?? word.word;

      acc.currentSentence.push(word);
      if (['.', '!', '?'].some(v => realWord.indexOf(v) !== -1) || index === array.length - 1) {
        acc.sentences.push(acc.currentSentence);
        acc.currentSentence = [];
      }

      return acc;
    },
    { sentences: [], currentSentence: [] }
  );

  const lines: Line[] = [];

  for (const sentence of sentences) {
    let totalChars = sentence.reduce((sum, word) => sum + (word.punctuated_word ?? word.word).length + 1, -1); // Start with -1 to consider spaces correctly
    let idealLineLength = Math.ceil(totalChars / Math.ceil(totalChars / charactersPerLine));
    let currentLine: WordBase[] = [];
    let currentLength = 0;

    sentence.forEach(word => {
      const wordLength = (word.punctuated_word ?? word.word).length;
      if (currentLine.length === 0) {
        // Start a new line
        currentLine.push(word);
        currentLength += wordLength;
      } else if (currentLength + 1 + wordLength <= idealLineLength) {
        // Add word to the current line
        currentLine.push(word);
        currentLength += wordLength + 1;
      } else {
        // Start a new line if current one reaches the ideal length
        lines.push({
          content: currentLine,
          start: currentLine[0].start,
          end: currentLine[currentLine.length - 1].end
        });
        currentLine = [];
        currentLine.push(word);
        currentLength = wordLength;
      }
    });
    // Don't forget to add the last line
    if (currentLine.length > 0) {
      lines.push({
        content: currentLine,
        start: currentLine[0].start,
        end: currentLine[currentLine.length - 1].end
      });
    }
  }
  return lines;
}

function getWordBackgroundAssString(word: WordBase, line: Line, settings: CaptionSettings, _: boolean, index: number) {
  const nextWord = line.content[index + 1];
  let dialogueString = `Dialogue: 0,${secondsToTimestamp(word.start)},${secondsToTimestamp(
    nextWord ? nextWord.start : word.end
  )},Default,,0,0,0,,`;

  dialogueString += line.content
    .map(w => {
      let theWord = w.punctuated_word ?? w.word;
      theWord = theWord.startsWith('-') ? ` ${theWord}` : theWord;
      if (settings.isUppercase) {
        theWord = theWord.toUpperCase();
      }
      return word === w ? `{\\rBackground}${theWord}{\\r}` : `${theWord}`;
    })
    .join(' ');

  dialogueString += '\n';

  return dialogueString;
}

function getWordAppearAssString(word: WordBase, line: Line, settings: CaptionSettings, _: boolean, index: number) {
  const wordStart = Math.floor((word.start - line.start) * 1000);
  let theWord = word.punctuated_word ?? word.word;
  if (settings.isUppercase) {
    theWord = theWord.toUpperCase();
  }
  let dialogueString = '';
  // Dialogue: 0,0:00:00.00,0:00:03.46,Default,,0,0,0,,I'm {\alpha&HFF\t(1000,1000,\alpha0)}a {\alpha&HFF\t(1500,1500,\alpha0)}subtitle
  if (index === 0) {
    dialogueString += `${theWord}`;
  } else {
    dialogueString += ` {\\alpha&HFF\\t(${wordStart},${wordStart},\\alpha0)}${theWord}`;
  }
  return dialogueString;
}

function getWordHighlightAssString(
  word: WordBase,
  line: Line,
  settings: CaptionSettings,
  isVertical: boolean,
  index: number
) {
  const nextWord = line.content[index + 1];
  const wordStart = Math.floor((word.start - line.start) * 1000);
  const wordEnd = nextWord
    ? Math.floor((nextWord.start - line.start) * 1000)
    : Math.floor((line.end - line.start) * 1000);
  let theWord = word.punctuated_word ?? word.word;
  theWord = theWord.startsWith('-') ? ` ${theWord}` : theWord;

  const horizontalActiveWordFontSize = settings.activeWordFontSize;
  const verticalActiveWordFontSize = settings.verticalActiveWordFontSize ?? settings.activeWordFontSize;
  const activeWordFontSize = isVertical ? verticalActiveWordFontSize : horizontalActiveWordFontSize;
  let verticalFontSize = settings.verticalFontSize ?? settings.fontSize ?? FONT_SIZE_HORIZONTAL;
  let horizontalFontSize = settings.fontSize ?? FONT_SIZE_HORIZONTAL;
  const fontSize = isVertical ? verticalFontSize : horizontalFontSize;
  if (settings.isUppercase) {
    theWord = theWord.toUpperCase();
  }
  let dialogueString = '';
  if (index === 0) {
    dialogueString += `{\\c${convertToARGBString(settings.highlightedWordColor)}${
      activeWordFontSize ? `\\fs${activeWordFontSize}` : ''
    }\\t(${wordEnd},${wordEnd},${activeWordFontSize ? `\\fs${fontSize}` : ''}\\c${convertToARGBString(
      settings.primaryColor
    )})}${theWord}`;
  } else {
    dialogueString += ` {\\c${convertToARGBString(settings.primaryColor)}${
      activeWordFontSize ? `\\fs${fontSize}` : ''
    }\\t(${wordStart},${wordStart},\\c${convertToARGBString(settings.highlightedWordColor)}${
      activeWordFontSize ? `\\fs${activeWordFontSize}` : ''
    })\\t(${wordEnd},${wordEnd},\\c${convertToARGBString(settings.primaryColor)}${
      activeWordFontSize ? `\\fs${fontSize}` : ''
    })}${theWord}`;
  }
  return dialogueString;
}

function secondsToTimestamp(seconds: number, isSrt = false) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds - Math.floor(seconds)) * 100);

  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
  const formattedMilliseconds = milliseconds.toString().padStart(isSrt ? 3 : 2, '0');

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}${isSrt ? ',' : '.'}${formattedMilliseconds}`;
}

// Convert HTML-style color to ARGB format
function convertToARGBString(htmlColor: string) {
  const colorRgb = Color(htmlColor).hex().replace('#', '');
  return `H${colorRgb.substring(4, 6)}${colorRgb.substring(2, 4)}${colorRgb.substring(0, 2)}`;
}
