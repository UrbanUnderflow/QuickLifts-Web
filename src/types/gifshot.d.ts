declare module 'gifshot' {
  interface GifshotOptions {
    gifWidth?: number;
    gifHeight?: number;
    images?: string[];
    video?: HTMLVideoElement[];
    videoElement?: HTMLVideoElement;
    webcamVideoElement?: HTMLVideoElement;
    cameraStream?: MediaStream;
    text?: string;
    fontWeight?: string;
    fontSize?: string;
    minFontSize?: string;
    resizeFont?: boolean;
    fontFamily?: string;
    fontColor?: string;
    textAlign?: string;
    textBaseline?: string;
    textXCoordinate?: number;
    textYCoordinate?: number;
    progressCallback?: (progress: number) => void;
    completeCallback?: () => void;
    numWorkers?: number;
    keepCameraOn?: boolean;
    saveRenderingContexts?: boolean;
    savedRenderingContexts?: CanvasRenderingContext2D[];
    crossOrigin?: string;
    numFrames?: number;
    frameDuration?: number;
    interval?: number;
    sampleInterval?: number;
    numWorkersScriptProcessor?: number;
    offset?: number;
    waterMark?: HTMLImageElement;
    waterMarkHeight?: number;
    waterMarkWidth?: number;
    waterMarkXCoordinate?: number;
    waterMarkYCoordinate?: number;
  }

  interface GifshotResult {
    error: boolean;
    errorCode?: string;
    errorMsg?: string;
    image?: string;
    cameraStream?: MediaStream;
    savedRenderingContexts?: CanvasRenderingContext2D[];
  }

  interface Gifshot {
    createGIF(options: GifshotOptions, callback: (result: GifshotResult) => void): void;
    takeSnapShot(options: GifshotOptions, callback: (result: GifshotResult) => void): void;
    stopVideoStreaming(cameraStream: MediaStream): void;
    isWebCamGIFSupported(): boolean;
    isSupported(): boolean;
    isExistingImagesGIFSupported(): boolean;
    isExistingVideoGIFSupported(codecs?: string[]): boolean;
    defaultOptions: GifshotOptions;
  }

  const gifshot: Gifshot;
  export default gifshot;
} 