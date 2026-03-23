import type { CapabilityReport, ConverterBackend } from './types'
import { FfmpegConverter } from './fallback-path/FfmpegConverter'

// TODO: re-enable fast path once WebCodecs frame decoding (mp4box demuxer) is implemented.
// The WebGPU shaders, palette generation, and GIF encoding are ready — only frame decode is missing.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createConverter(_cap: CapabilityReport): ConverterBackend {
  return new FfmpegConverter()
}
