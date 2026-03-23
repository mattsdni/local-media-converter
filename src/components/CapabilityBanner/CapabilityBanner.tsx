import type { CapabilityReport } from '../../conversion/types'

interface Props {
  capability: CapabilityReport | null
}

export function CapabilityBanner({ capability }: Props) {
  if (!capability) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm">
        <span className="animate-pulse">Detecting capabilities…</span>
      </div>
    )
  }

  const isGpu = capability.path === 'fast'

  return (
    <div className="space-y-1">
      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
        isGpu
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
      }`}>
        <span>{isGpu ? '⚡' : '🔄'}</span>
        <span>
          {isGpu
            ? 'GPU-accelerated mode'
            : 'Compatibility mode (software)'}
        </span>
        <span className="ml-auto text-xs font-normal opacity-70">
          {isGpu ? 'WebGPU + WebCodecs' : 'ffmpeg.wasm'}
        </span>
      </div>

      {capability.warnings.map((w, i) => (
        <div key={i} className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs">
          <span>⚠️</span>
          <span>{w}</span>
        </div>
      ))}

      <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs text-gray-400">
        <span>🔒</span>
        <span>Files never leave your device — all processing happens locally.</span>
      </div>
    </div>
  )
}
