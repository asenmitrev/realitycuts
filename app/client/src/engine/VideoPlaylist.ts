import { VideoObject } from '../types';
import { VideoElementCache } from './VideoElementCache';
import { convertToBlobUrl } from './convertToBlobUrl';

export class VideoPlaylist {
  private readonly ALT_CACHE_SIZE: number = 2;
  private readonly PLAYBACK_CACHE_SIZE: number = 4;
  private _videoMap: VideoObject[][];
  private altMap: number[];
  private lastVideoIndex: number = -1;
  private lastFoundIndex: number = -1;

  constructor(videoMap: VideoObject[][], altMap: number[], private cache: VideoElementCache) {
    this._videoMap = videoMap;
    this.altMap = altMap;
    this.reloadCache();
  }

  handlePlay(currentTime: number) {
    const [currentAltMap, currentAltMapIndex] = this.getCurrentlyPlayingAltPlaylist(currentTime);

    if (currentAltMap) {
      this.reloadCache(currentAltMapIndex, currentAltMap);
    }

    const currentBroll = currentAltMap?.[this.altMap[currentAltMapIndex]];
    const needsCaching =
      currentBroll &&
      (currentBroll.brollType === 'AI_PHOTO' ? !currentBroll.imageElement : !currentBroll.element);
    if (needsCaching) {
      this.cacheObject(currentBroll);
    }
    const nextVideo = this.getNextVideo(currentTime);
    return [currentAltMap?.[this.altMap[currentAltMapIndex]], nextVideo[0]];
  }

  reloadCache(currentAltMapIndex: number = 0, currentAltMap: VideoObject[] = this.videoMap[0]) {
    if (this.lastVideoIndex !== currentAltMapIndex) {
      // Unlink old alts from cache
      this.videoMap[this.lastVideoIndex]?.forEach(v => setTimeout(() => this.uncacheObject(v), 0));
      this.lastVideoIndex = currentAltMapIndex;

      // Load next queued videos into cache
      const videosToCache = Array.from({ length: this.PLAYBACK_CACHE_SIZE }, (_, i) => {
        const index = currentAltMapIndex + i;
        return this.videoMap[index]?.[this.altMap[index]];
      }).filter(
        video =>
          video &&
          (video.brollType === 'AI_PHOTO' ? !video.imageElement : !video.element)
      );

      videosToCache.forEach(video => this.cacheObject(video));
    }

    this.reloadCacheForAlt(currentAltMapIndex, currentAltMap);
  }

  reloadCacheForAlt(currentAltMapIndex: number, currentAltMap: VideoObject[]) {
    if (currentAltMap) {
      // Load new alts into cache
      currentAltMap?.forEach((v, idx) => {
        const currentlyFocusedVideoIndex = this.altMap[currentAltMapIndex];

        // Create an array of indices that should be cached
        const indicesToCache = [];
        for (let i = 1; i <= this.ALT_CACHE_SIZE; i++) {
          const indexToCache = (currentlyFocusedVideoIndex + i) % currentAltMap.length;
          indicesToCache.push(indexToCache);
        }

        // If this index should be cached and isn't already, cache it
        if (indicesToCache.includes(idx) && !v.element) {
          this.cacheObject(v);
        }
        // If this index shouldn't be cached but is cached, uncache it
        else if (!indicesToCache.includes(idx) && idx !== currentlyFocusedVideoIndex && v.element) {
          this.uncacheObject(v);
        }
      });
    }
  }

  getCurrentlyPlayingAltPlaylist(currentTime: number): [VideoObject[] | undefined, number] {
    // Early return if empty
    if (this.videoMap.length === 0) return [undefined, -1];

    // Maintain last known position as a starting point
    if (this.lastFoundIndex >= 0 && this.lastFoundIndex < this.videoMap.length) {
      const playlist = this.videoMap[this.lastFoundIndex];
      const currentVid = playlist[this.altMap[this.lastFoundIndex]];
      if (currentVid && currentVid.timeStart <= currentTime && currentTime < currentVid.timeEnd) {
        return [playlist, this.lastFoundIndex];
      }
    }

    let low = 0;
    let high = this.videoMap.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const playlist = this.videoMap[mid];
      const currentVid = playlist[this.altMap[mid]];

      if (!currentVid) {
        // Handle potential undefined values
        high = mid - 1;
        continue;
      }

      if (currentTime < currentVid.timeStart) {
        high = mid - 1;
      } else if (currentTime >= currentVid.timeEnd) {
        low = mid + 1;
      } else {
        // We found the right segment
        this.lastFoundIndex = mid;
        return [playlist, mid];
      }
    }

    // If binary search failed, fall back to linear search as a safety measure
    // (only needed if time segments are overlapping or not strictly ordered)
    const index = this.videoMap.findIndex(altPlaylist =>
      altPlaylist
        .filter(vidObject => !!vidObject)
        .some(vidObject => vidObject.timeStart <= currentTime && currentTime < vidObject.timeEnd)
    );

    if (index !== -1) {
      this.lastFoundIndex = index;
      return [this.videoMap[index], index];
    }

    return [undefined, -1];
  }

  getNextVideo(currentTime: number): [VideoObject | undefined, number] {
    // Early return if empty
    if (this.videoMap.length === 0) return [undefined, -1];

    const nextVideoIndex = this.videoMap.findIndex(
      (map, index) => (map[this.altMap[index]]?.timeStart ?? 0) > currentTime
    );
    if (nextVideoIndex !== -1) {
      return [this.videoMap[nextVideoIndex][this.altMap[nextVideoIndex]], nextVideoIndex];
    }
    return [undefined, -1];
  }

  async cacheObject(obj: VideoObject): Promise<VideoObject> {
    try {
      if (obj.brollType === 'AI_PHOTO') {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.setAttribute('data-loading', '1');
        const blobUrl = await convertToBlobUrl(obj.url);
        img.src = blobUrl;
        img.onload = () => img.setAttribute('data-loading', '0');
        obj.imageElement = img;
        return obj;
      }
      const element = this.cache.getElementAndLinkToNode(obj.url, obj.altId ?? '');
      obj.element = element;
      element.setAttribute('data-loading', '1');
      const blobUrl = await convertToBlobUrl(obj.url);
      element.src = blobUrl;
      element.setAttribute('data-loading', '0');
      element.currentTime = obj.offsetStart ?? 0;
      element.volume = 0;
      element.loop = true;
      element.autoplay = false;
      element.muted = true;
      return obj;
    } catch (error) {
      console.error(`Failed to cache object with URL ${obj.url}:`, error);
      this.uncacheObject(obj);
      throw error;
    }
  }

  uncacheObject(obj: VideoObject) {
    if (obj.brollType === 'AI_PHOTO' && obj.imageElement) {
      if (obj.imageElement.src?.startsWith('blob:')) {
        URL.revokeObjectURL(obj.imageElement.src);
      }
      obj.imageElement = undefined;
    } else {
      this.cache.unlinkVideoObjectFromElement(obj);
    }
  }

  get videoMap() {
    return this._videoMap;
  }

  setPlaylist(videoMap: VideoObject[][], altMap: number[], currentTime: number) {
    this._videoMap = videoMap.sort((a, b) => a[0]?.timeStart - b[0]?.timeStart);
    this.altMap = altMap;
    this.handlePlay(currentTime);
  }

  destroy() {
    this.videoMap.forEach(altMap =>
      altMap.forEach(videoObject => {
        if (videoObject.brollType === 'AI_PHOTO' && videoObject.imageElement) {
          if (videoObject.imageElement.src?.startsWith('blob:')) {
            URL.revokeObjectURL(videoObject.imageElement.src);
          }
          videoObject.imageElement = undefined;
        } else {
          if (videoObject.element?.src && videoObject.element.src.startsWith('blob:')) {
            URL.revokeObjectURL(videoObject.element.src);
          }
          this.cache.unlinkVideoObjectFromElement(videoObject);
        }
      })
    );
    this.cache.clear();
  }

  updatePlaybackRate(rate: number) {
    this.videoMap.forEach(altMap =>
      altMap.forEach(videoObject => {
        if (videoObject.element) {
          videoObject.element.playbackRate = rate;
        }
        // AI_PHOTO uses imageElement; no playback rate to set
      })
    );
  }
}
