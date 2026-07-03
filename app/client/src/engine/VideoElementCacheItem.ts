export class VideoElementCacheItem {
  _id: string;
  _url: string;
  _element: HTMLVideoElement;

  constructor(url: string, id: string) {
    this._id = id;
    this._url = url;
    this._element = this._createElement();
  }

  _createElement() {
    const videoElement = document.createElement('video');
    videoElement.setAttribute('crossorigin', 'anonymous');
    videoElement.setAttribute('webkit-playsinline', '');
    videoElement.setAttribute('playsinline', '');
    // This seems necessary to allow using video as a texture. See:
    // https://bugs.chromium.org/p/chromium/issues/detail?id=898550
    // https://github.com/pixijs/pixi.js/issues/5996
    videoElement.preload = 'auto';
    return videoElement;
  }

  get element() {
    return this._element;
  }

  set element(element) {
    this._element = element;
  }
}
