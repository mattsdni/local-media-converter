import type { CapabilityReport } from './types'

export async function detectCapabilities(): Promise<CapabilityReport> {
  const warnings: string[] = []
  const isMobile = /Mobi|Android/i.test(navigator.userAgent)

  const hasWebGPU = 'gpu' in navigator
  const hasWebCodecs = 'VideoDecoder' in window

  let adapterInfo: GPUAdapterInfo | null = null
  let isSoftwareRenderer = false

  if (hasWebGPU) {
    try {
      const adapter = await navigator.gpu.requestAdapter()
      if (adapter) {
        // `adapter.info` is a GPUAdapterInfo object (non-async in newer spec)
        adapterInfo = adapter.info
        isSoftwareRenderer = (adapterInfo?.description ?? '')
          .toLowerCase()
          .includes('swiftshader')
        if (isSoftwareRenderer) {
          warnings.push('GPU acceleration unavailable — conversion will be slower than usual.')
        }
      }
    } catch {
      // requestAdapter can throw in some environments
    }
  }

  if (isMobile) {
    warnings.push('Mobile device detected — files are limited to 30 seconds / 720p.')
  }

  // Use fast path only when both WebGPU and WebCodecs are available and GPU is real
  const path =
    hasWebGPU && hasWebCodecs && !isSoftwareRenderer ? 'fast' : 'fallback'

  return {
    webgpu: hasWebGPU,
    webcodecs: hasWebCodecs,
    isMobile,
    isSoftwareRenderer,
    adapterInfo,
    path,
    warnings,
  }
}
