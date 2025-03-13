declare module 'gif.js' {
  interface GifJsOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    repeat?: number;
    background?: string;
    transparent?: string | null;
    dither?: boolean;
    debug?: boolean;
  }

  interface GifJsFrameOptions {
    delay?: number;
    copy?: boolean;
    dispose?: number;
  }

  class GifJs {
    constructor(options: GifJsOptions);
    on(event: 'start' | 'abort' | 'progress' | 'finished', callback: (data?: any) => void): void;
    render(): void;
    abort(): void;
    addFrame(element: CanvasRenderingContext2D | HTMLImageElement | HTMLCanvasElement, options?: GifJsFrameOptions): void;
  }

  export default GifJs;
} 