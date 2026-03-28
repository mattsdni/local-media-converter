import { ConversionSettings } from './ConversionSettings'
import { useConversion } from '../../hooks/useConversion'
import { useConversionStore } from '../../store/conversionStore'

export function ConversionPanel() {
  const { convert } = useConversion()
  const capability = useConversionStore((s) => s.capability)
  const inputMetadata = useConversionStore((s) => s.inputMetadata)
  const options = useConversionStore((s) => s.options)

  // Estimate output file size (rough)
  const estimatedMb = (() => {
    if (!inputMetadata) return null
    const durationSec = options.endTime != null && options.startTime != null
      ? options.endTime - options.startTime
      : options.endTime ?? inputMetadata.durationSec
    const frames = options.fps * durationSec
    const ratio = options.scale > 0
      ? Math.min(options.scale / inputMetadata.width, options.scale / inputMetadata.height)
      : 1
    const w = Math.round(inputMetadata.width * ratio)
    const h = Math.round(inputMetadata.height * ratio)
    const bytes = frames * w * h * 0.75 * 0.4 // empirical
    return (bytes / 1024 / 1024).toFixed(0)
  })()

  const mobileWarning = capability?.isMobile && inputMetadata && inputMetadata.durationSec > 30

  return (
    <div className="space-y-6">
      <ConversionSettings />

      {mobileWarning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <span>⚠️</span>
          <span>Your video is longer than 30 seconds. On mobile, conversion will be trimmed to 30 seconds to avoid memory issues.</span>
        </div>
      )}

      {estimatedMb && Number(estimatedMb) > 50 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
          <span>ℹ️</span>
          <span>Estimated output: ~{estimatedMb} MB. GIF files can be large — consider reducing FPS or output width.</span>
        </div>
      )}

      <button
        onClick={convert}
        className="w-full py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold text-base transition-all shadow-sm"
      >
        Convert to GIF
      </button>
    </div>
  )
}
