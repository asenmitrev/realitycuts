import { Segment } from '../../../../types/video-ai-data';

export function splitLongSegments(s: Segment): [number, Segment[]] {
  const out: Segment[] = [];
  let timeEnd = s.timeEnd;

  const altDuration = (s.alternatives?.[0]?.duration ?? 3) - 0.25; // Remove quarter second to account for imprecise cuts
  if (s.timeEnd - s.timeStart > altDuration) {
    const segment1 = {
      ...s,
      timeEnd: s.timeStart + altDuration,
      alternatives: s.alternatives.slice(0, 1)
    };
    const nextAltDuration = (s.alternatives[1]?.duration ?? 3) - 0.25;
    const segment2 = {
      ...s,
      timeStart: s.timeStart + altDuration,
      timeEnd: s.timeStart + altDuration + nextAltDuration,
      alternatives: s.alternatives.slice(1).map((a, index) => ({
        ...a,
        isFocused: index === 0
      }))
    };
    if (segment2.timeEnd - timeEnd > 2) {
      segment2.timeEnd = timeEnd + 2;
      out.push(segment1, segment2);
      timeEnd = segment2.timeEnd;
    } else if (segment2.timeEnd - segment2.timeStart > nextAltDuration) {
      const [newTimeEnd, recursiveSegments] = splitLongSegments(segment2);
      timeEnd = newTimeEnd;
      out.push(segment1, ...recursiveSegments);
    } else {
      timeEnd = segment2.timeEnd;
      out.push(segment1, segment2);
    }
  } else {
    out.push(s);
  }
  return [timeEnd, out];
}
