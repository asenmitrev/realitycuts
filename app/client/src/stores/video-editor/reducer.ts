import { v4 as uuid } from 'uuid';
import { PlaylistState, Segment, VideoAIData, VideoObject, VideoPlayerAction } from '../../types';

const formatPlaylist = (videoMap: VideoObject[][], altMap: number[]) => {
  return videoMap
    .map((videoAltArray, index) => videoAltArray[altMap[index]])
    .filter(v => !!v)
    .sort((a, b) => (a.timeStart > b.timeStart ? 1 : -1));
};

const mapSegments = (segments: Segment[]): VideoObject[][] => {
  return segments.map(segment => {
    return segment.alternatives.map(alt => {
      return {
        objectId: uuid(),
        altId: alt._id ?? uuid(),
        segmentId: segment._id ?? uuid(),
        timeStart: segment.timeStart,
        timeEnd: segment.timeEnd,
        score: alt.score,
        duration: alt.duration ?? 0,
        offsetStart: alt.offsetStart,
        isVisible: alt.isVisible ?? true,
        isFocused: alt.isFocused ?? false,
        keywords: segment.keywords,
        url: alt.preview,
        leftPosition: alt.leftPosition ?? 0,
        topPosition: alt.topPosition ?? 0,
        thumbnail: alt.thumbnailUrl,
        type: alt.type,
        isVertical: alt.isVertical ?? false,
        videoId: alt.videoId,
        id: alt.id,
        link: alt.link,
        title: alt.title,
        dbId: alt.dbId,
        brollType: alt.brollType
      };
    });
  });
};

export const initializePlaylistState = (d: VideoAIData): PlaylistState => {
  const videoMap = mapSegments(d.segments);
  const altMap = videoMap.map(items => {
    const focusedVideoIndex = items.findIndex(alt => alt.isFocused);
    return focusedVideoIndex >= 0 ? focusedVideoIndex : 0;
  });
  const playlist = formatPlaylist(videoMap, altMap);
  return { videoMap, altMap, playlist, needsRedraw: true, isDirty: false };
};

export const playlistReducer = (state: PlaylistState, action: VideoPlayerAction): PlaylistState => {
  if (action.type === 'HYDRATE') {
    if (state.videoMap.length === 0) {
      return initializePlaylistState(action.payload.data);
    }
    return state;
  }
  if (action.type === 'SET_IS_DIRTY') {
    return { ...state, isDirty: action.payload.isDirty };
  }
  if (action.type === 'REPLACE_SEGMENTS') {
    const segments = action.payload.segments.sort((a, b) => a.timeStart - b.timeStart);
    const timeStart = segments[0].timeStart;
    const timeEnd = segments[segments.length - 1].timeEnd;

    const videoMap = state.videoMap
      .map(altPlaylist => {
        let out: VideoObject[] | null = altPlaylist;
        if (out[0].timeStart < timeStart && out[0].timeEnd > timeStart) {
          out = altPlaylist.map(alt => ({ ...alt, timeEnd: timeStart }));
        }
        if (out[0].timeStart < timeEnd && out[0].timeEnd > timeEnd) {
          out = altPlaylist.map(alt => ({ ...alt, timeStart: timeEnd }));
        }
        if (out[0].timeStart >= timeStart && out[0].timeEnd <= timeEnd) {
          out = null;
        }
        return out;
      })
      .filter((v): v is VideoObject[] => !!v);
    const newVideoMap = videoMap.concat(mapSegments(segments)).sort((a, b) => (a[0].timeStart > b[0].timeStart ? 1 : -1));
    const altMap = newVideoMap.map(altPlaylist => {
      const focusedVideoIndex = altPlaylist.findIndex(alt => alt.isFocused);
      return focusedVideoIndex >= 0 ? focusedVideoIndex : 0;
    });
    const playlist = formatPlaylist(newVideoMap, altMap);
    return { ...state, videoMap: newVideoMap, altMap, playlist, needsRedraw: true, isDirty: true };
  }
  if (action.type === 'TOGGLE_CURRENT_ALT_ENABLED') {
    const currentTime = action.payload.currentTime;
    const idx = state.videoMap.findIndex(altPlaylist =>
      altPlaylist.some(vidObject => vidObject.timeStart <= currentTime && currentTime < vidObject.timeEnd)
    );
    const currentBrollMap = state.videoMap[idx];
    const currentAltIdx = state.altMap[idx];
    if (typeof currentAltIdx === 'number' && currentBrollMap?.[state.altMap[idx]]) {
      const currentAlt = currentBrollMap?.[state.altMap[idx]];
      const videoMap = state.videoMap.map(altPlaylist =>
        altPlaylist.map(alt => {
          if (currentAlt === alt) {
            return { ...alt, isVisible: !alt.isVisible };
          }
          return alt;
        })
      );
      const playlist = formatPlaylist(videoMap, state.altMap);
      return { ...state, videoMap, playlist, needsRedraw: true, isDirty: true };
    }
    return state;
  }
  if (action.type === 'TOGGLE_CURRENT_ALT_VARIATION') {
    const video = action.payload.video;
    const idx = state.videoMap.findIndex(altPlaylist => altPlaylist.some(vidObject => vidObject.altId === video.altId));
    const currentBrollMap = state.videoMap[idx];
    const currentAltIdx = state.altMap[idx];
    const altMap = [...state.altMap];
    if (typeof currentAltIdx === 'number' && currentBrollMap?.[state.altMap[idx]]) {
      const currentAlt = currentBrollMap?.[state.altMap[idx]];
      altMap[idx] = (currentAltIdx + 1) % currentBrollMap.length;
      const videoMap = state.videoMap.map(altPlaylist =>
        altPlaylist.map(alt => {
          if (currentAlt === alt) {
            return { ...alt, isVisible: true };
          }
          return alt;
        })
      );
      const playlist = formatPlaylist(videoMap, altMap);
      return { ...state, videoMap, altMap, playlist, needsRedraw: true, isDirty: true };
    }
    return state;
  }
  if (action.type === 'TOGGLE_VIDEO_VISIBLE') {
    const video = action.payload.video;
    const videoMap = state.videoMap.map(altPlaylist =>
      altPlaylist.map(alt => {
        if (alt.altId === video.altId) {
          return { ...alt, isVisible: !alt.isVisible };
        }
        return alt;
      })
    );
    const playlist = formatPlaylist(videoMap, state.altMap);
    return { ...state, playlist, videoMap, needsRedraw: true, isDirty: true };
  }
  if (action.type === 'CHANGE_VIDEO_POSITION') {
    const video = action.payload.video;
    const videoMap = state.videoMap.map(altPlaylist => {
      if (altPlaylist.find(vidObject => vidObject.altId === video.altId)) {
        return altPlaylist.map(vidObject => ({
          ...vidObject,
          leftPosition: action.payload.leftPosition,
          topPosition: action.payload.topPosition
        }));
      }
      return altPlaylist;
    });
    const playlist = formatPlaylist(videoMap, state.altMap);
    return { ...state, playlist, videoMap, needsRedraw: false, isDirty: true };
  }
  if (action.type === 'CHANGE_VIDEO_TIME') {
    const timeStart = action.payload.timeStart;
    const timeEnd = action.payload.timeEnd;
    const offsetStart = action.payload.offsetStart;
    const video = action.payload.video;
    const videoMap = state.videoMap.map(altPlaylist => {
      if (altPlaylist.find(vidObject => vidObject.altId === video.altId)) {
        return altPlaylist.map(vidObject => ({ ...vidObject, timeStart, timeEnd, offsetStart }));
      }
      return altPlaylist;
    });
    const playlist = formatPlaylist(videoMap, state.altMap);
    return { ...state, playlist, videoMap, needsRedraw: true, isDirty: true };
  }
  if (action.type === 'ADD_ALTS') {
    const keywords = action.payload.keywords;
    const alternatives = action.payload.alternatives;
    const timeStart = action.payload.timeStart;
    const timeEnd = action.payload.timeEnd;
    const videoMap = [
      ...state.videoMap,
      alternatives.map((alt, index) => ({
        altId: uuid(),
        segmentId: undefined,
        timeStart,
        timeEnd,
        offsetStart: 0,
        duration: alt.duration ?? 0,
        isVisible: alt.isVisible ?? true,
        isFocused: index === 0,
        score: alt.score,
        keywords,
        id: alt.id,
        dbId: alt.dbId,
        type: alt.type,
        url: alt.preview,
        leftPosition: alt.leftPosition ?? 0,
        isVertical: alt.isVertical ?? false,
        topPosition: alt.topPosition ?? 0,
        thumbnail: alt.thumbnailUrl,
        link: alt.link,
        title: alt.title,
        brollType: alt.brollType
      }))
    ];
    const altMap = [...state.altMap, 0];
    const playlist = formatPlaylist(videoMap, altMap);
    return { videoMap, altMap, playlist, needsRedraw: true, isDirty: true };
  }
  if (action.type === 'REMOVE_SEGMENT') {
    const video = action.payload.video;
    const segmentIndex = state.videoMap.findIndex(alts => alts.find(v => v.altId === video.altId));
    const videoMap = state.videoMap.filter(alts => !alts.find(v => v.altId === video.altId));
    const altMap = state.altMap.filter((_, index) => index !== segmentIndex);
    const playlist = formatPlaylist(videoMap, altMap);
    return { videoMap, altMap, playlist, needsRedraw: true, isDirty: true };
  }
  if (action.type === 'REPLACE_ALTS') {
    const video = action.payload.video;
    const keywords = action.payload.keywords;
    const alternatives = action.payload.alternatives;
    const altMap = [...state.altMap];
    const videoMap = state.videoMap.map((altPlaylist, altIndex) => {
      if (altPlaylist.findIndex(v => v.altId === video.altId) !== -1) {
        altMap[altIndex] = 0;
        return alternatives.map((alt, index) => ({
          altId: alt._id ?? uuid(),
          segmentId: video.segmentId,
          timeStart: video.timeStart,
          timeEnd: Math.min(video.timeEnd, video.timeStart + alt.duration),
          offsetStart: 0,
          duration: alt.duration ?? 0,
          isVisible: alt.isVisible ?? true,
          score: alt.score,
          isFocused: index === 0,
          keywords,
          dbId: alt.dbId,
          type: alt.type,
          id: alt.id,
          url: alt.preview,
          leftPosition: alt.leftPosition ?? 0,
          topPosition: alt.topPosition ?? 0,
          isVertical: alt.isVertical ?? false,
          thumbnail: alt.thumbnailUrl,
          link: alt.link,
          title: alt.title,
          brollType: alt.brollType
        }));
      }
      return altPlaylist;
    });
    const playlist = formatPlaylist(videoMap, altMap);
    return { videoMap, altMap, playlist, needsRedraw: true, isDirty: true };
  }
  return state;
};
