export interface ConversionOptions {
  fps: number
  scale: number // output width in px; -1 = keep original
  quality: number // 1–10
  dither: 'none' | 'bayer' | 'floyd-steinberg'
  startTime?: number
  endTime?: number
}

export interface ConversionProgress {
  stage: 'decoding' | 'processing' | 'encoding' | 'finalizing'
  framesTotal: number
  framesProcessed: number
  percent: number
  message: string
}

export interface ConversionResult {
  blob: Blob
  durationMs: number
  frameCount: number
  outputSizeBytes: number
  path: 'fast' | 'fallback'
}

export type ConversionErrorCode =
  | 'FILE_TOO_LARGE'
  | 'DURATION_EXCEEDED'
  | 'UNSUPPORTED_CODEC'
  | 'WEBGPU_INIT_FAILED'
  | 'WASM_LOAD_FAILED'
  | 'OOM'
  | 'CANCELLED'
  | 'UNKNOWN'

export interface ConversionError {
  code: ConversionErrorCode
  message: string
  recoverable: boolean
}

export interface ConverterBackend {
  convert(
    file: File,
    options: ConversionOptions,
    onProgress: (p: ConversionProgress) => void,
    signal: AbortSignal,
  ): Promise<ConversionResult>
  dispose(): void
}

export interface VideoMetadata {
  durationSec: number
  width: number
  height: number
}

export interface CapabilityReport {
  webgpu: boolean
  webcodecs: boolean
  isMobile: boolean
  isSoftwareRenderer: boolean
  adapterInfo: GPUAdapterInfo | null
  path: 'fast' | 'fallback'
  warnings: string[]
}
