export interface VideoFrame {
  data: Uint8Array;
  timestamp: number;
  width: number;
  height: number;
  format: string;
}

export interface AudioFrame {
  data: Float32Array;
  timestamp: number;
  sampleRate: number;
  channelCount: number;
}

export interface MediaInfo {
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec?: string;
  audioCodec?: string;
  width?: number;
  height?: number;
  framerate?: number;
  sampleRate?: number;
}

export interface PlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  buffered: TimeRanges | null;
}

export interface DecoderOptions {
  useWebCodecs: boolean;
  useFFmpeg: boolean;
}

export interface RenderOptions {
  preferWebGPU: boolean;
  canvas: HTMLCanvasElement;
}

export interface AudioOptions {
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
}