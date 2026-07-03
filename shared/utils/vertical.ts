import { HighlightSegment, RecroppedVideoFrame } from '../types';

export const reduceCroppedOutput = (json: {
  body: {
    outputs: any[][];
  };
}) => {
  const theFinalSolution: RecroppedVideoFrame[] = [];
  for (const output of json.body.outputs) {
    const data = output.find(o => o.Key === 'data');
    if (Array.isArray(data?.Value)) {
      const output = data?.Value?.reduce(
        (
          acc: {
            reduced: RecroppedVideoFrame[];
          },
          item: any
        ) => {
          const crops = item.find((i: any) => i.Key === 'crops')?.Value as number;
          const frameNumber = item.find((i: any) => i.Key === 'frame_number')?.Value as number;
          const timeSeconds = item.find((i: any) => i.Key === 'time_seconds')?.Value as number;

          if (Array.isArray(crops) && crops && frameNumber && timeSeconds) {
            const nine16Crop = crops.find(v => v.Key === '9:16-active-speaker')?.Value;
            if (Array.isArray(nine16Crop) && Array.isArray(nine16Crop[0])) {
              const x1 = nine16Crop[0].find(k => k.Key === 'x1')?.Value;
              const x2 = nine16Crop[0].find(k => k.Key === 'x2')?.Value;
              const y1 = nine16Crop[0].find(k => k.Key === 'y1')?.Value;
              const y2 = nine16Crop[0].find(k => k.Key === 'y2')?.Value;

              const prevItem = acc.reduced.length > 0 ? acc.reduced[acc.reduced.length - 1] : null;

              if (prevItem) {
                if (x1 !== undefined && x2 !== undefined && y1 !== undefined && y2 !== undefined) {
                  if (prevItem.x1 === x1 && prevItem.x2 === x2 && prevItem.y1 === y1 && prevItem.y2 === y2) {
                    prevItem.frameEnd = frameNumber;
                    prevItem.timeEnd = timeSeconds;
                  } else {
                    prevItem.timeEnd = timeSeconds;
                    acc.reduced.push({
                      x1,
                      x2,
                      y1,
                      y2,
                      frameStart: frameNumber,
                      frameEnd: frameNumber,
                      timeStart: timeSeconds,
                      timeEnd: timeSeconds
                    });
                  }
                }
              } else {
                acc.reduced.push({
                  x1,
                  x2,
                  y1,
                  y2,
                  frameStart: frameNumber,
                  frameEnd: frameNumber,
                  timeStart: timeSeconds,
                  timeEnd: timeSeconds
                });
              }
            }
          }
          return acc;
        },
        {
          reduced: [] as RecroppedVideoFrame[]
        }
      );
      theFinalSolution.push(...output.reduced);
    }
  }
  return theFinalSolution;
};
export function findCropInfo(cropArray: RecroppedVideoFrame[], currentTime: number) {
  let low = 0;
  let high = cropArray.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const item = cropArray[mid];
    if (currentTime >= item.timeStart && currentTime <= item.timeEnd) {
      return item;
    } else if (currentTime < item.timeStart) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return null;
}

export const adjustRecropData = (recropArray: RecroppedVideoFrame[], segments: HighlightSegment[]) => {
  let cumulativeTime = 0;
  const out: RecroppedVideoFrame[] = [];
  segments.forEach(segment => {
    const segmentDuration = segment.end - segment.start;

    // Get all recrops within the segment
    // (StartA <= EndB)  and  (EndA >= StartB)
    const recrops = recropArray.filter(frame => frame.timeStart <= segment.end && frame.timeEnd >= segment.start);

    const mappedRecrops = recrops.map(frame => {
      let timeStart = 0;
      if (frame.timeStart <= segment.start) {
        timeStart = cumulativeTime;
      } else if (frame.timeStart > segment.start) {
        timeStart = cumulativeTime + frame.timeStart - segment.start;
      }
      let timeEnd = 0;
      if (frame.timeEnd >= segment.end) {
        timeEnd = cumulativeTime + segmentDuration;
      } else {
        timeEnd = cumulativeTime + frame.timeEnd - segment.start;
      }
      return {
        x1: frame.x1,
        x2: frame.x2,
        y1: frame.y1,
        y2: frame.y2,
        frameStart: frame.frameStart,
        frameEnd: frame.frameEnd,
        timeStart,
        timeEnd
      };
    });
    const filteredRecrops = mappedRecrops.filter(frame => frame.timeStart < frame.timeEnd);

    out.push(...filteredRecrops);

    cumulativeTime += segmentDuration;
  });

  return out;
};
