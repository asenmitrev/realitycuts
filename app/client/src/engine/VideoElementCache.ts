import { VideoObject } from '../types';
import { VideoElementCacheItem } from './VideoElementCacheItem';

export class VideoElementCache {
  private _cacheItems: VideoElementCacheItem[];
  private _cacheItemsInitialised: boolean;

  constructor(cache_size = 10) {
    this._cacheItems = [];
    this._cacheItemsInitialised = false;
    for (let i = 0; i < cache_size; i++) {
      // Create a video element and cache
      this._cacheItems.push(new VideoElementCacheItem('', ''));
    }
  }

  init() {
    if (!this._cacheItemsInitialised) {
      for (const cacheItem of this._cacheItems) {
        try {
          cacheItem.element.load();
          cacheItem.element.play().then(
            () => {
              cacheItem.element.pause();
            },
            e => {
              if (e.name !== 'NotSupportedError') throw e;
            }
          );
        } catch (e) {
          //console.log(e.name);
        }
      }
    }
    this._cacheItemsInitialised = true;
  }

  getElementAndLinkToNode(url: string, id: string) {
    // Try and get an already intialised element.
    for (const cacheItem of this._cacheItems) {
      // For some reason an uninitialised videoElement has its sr attribute set to the windows href. Hence the below check.
      if (cacheItem._url === url && cacheItem._id === id) {
        return cacheItem.element;
      }

      if (!cacheItem._url) {
        cacheItem._url = url;
        cacheItem._id = id;
        // attach node to the element
        return cacheItem.element;
      }
    }
    // If we didn't reach the maximum or couldn't reuse an item, create a new one
    const cacheItem = new VideoElementCacheItem(url, id);
    this._cacheItems.push(cacheItem);
    this._cacheItemsInitialised = false;
    return cacheItem.element;
  }

  /**
   * Unlink any media node currently linked to a cached video element.
   *
   * @param {VideoElement} element The element to unlink from any media nodes
   */
  unlinkVideoObjectFromElement(vidObj: VideoObject) {
    const element = vidObj.element;
    for (const cacheItem of this._cacheItems) {
      if (cacheItem.element === element) {
        // First stop any playback
        element?.pause();

        // Clear all event listeners (important for Safari)
        element.oncanplay = null;
        element.oncanplaythrough = null;
        element.onended = null;
        element.onerror = null;
        element.onloadeddata = null;
        element.onloadedmetadata = null;
        element.onpause = null;
        element.onplay = null;
        element.onplaying = null;
        element.ontimeupdate = null;
        element.onwaiting = null;
        // Properly release blob URL
        if (element.src) {
          URL.revokeObjectURL(element.src);
        }

        // Clear src and trigger load to release resources
        cacheItem._url = '';
        cacheItem._id = '';
        element.src = '';
        element.load(); // Important: forces Safari to properly release resources
      }
    }
    vidObj.element = undefined;
  }

  clear() {
    for (const cacheItem of this._cacheItems) {
      const element = cacheItem.element;
      // First stop any playback
      element?.pause();

      // Clear all event listeners (important for Safari)
      if (element) {
        element.oncanplay = null;
        element.oncanplaythrough = null;
        element.onended = null;
        element.onerror = null;
        element.onloadeddata = null;
        element.onloadedmetadata = null;
        element.onpause = null;
        element.onplay = null;
        element.onplaying = null;
        element.ontimeupdate = null;
        element.onwaiting = null;
      }

      // Properly release blob URLs to prevent memory leaks
      if (element?.src) {
        URL.revokeObjectURL(element.src);
      }

      // Clear src and trigger load to release resources
      if (element) {
        element.src = '';
        element.load(); // Important: forces Safari to properly release resources
      }

      // Reset cache item
      cacheItem._url = '';
      cacheItem._id = '';
    }
  }

  get length() {
    return this._cacheItems.length;
  }

  // get unused() {
  //     let count = 0;
  //     for (let cacheItem of this._cacheItems) {
  //         // For some reason an uninitialised videoElement has its sr attribute set to the windows href. Hence the below check.
  //         if (!mediaElementHasSource(cacheItem.element)) count += 1;
  //     }
  //     return count;
  // }
}
// function mediaElementHasSource({ src, srcObject }: HTMLVideoElement) {
//   return !((src === '' || src === undefined) && srcObject == null);
// }
