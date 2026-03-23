import { useConversion } from '../../hooks/useConversion'
import { useConversionStore } from '../../store/conversionStore'
import { isFfmpegReady } from '../../conversion/fallback-path/FfmpegConverter'

const STAGE_LABELS = {
  decoding: 'Loading',
  processing: 'Analyzing',
  encoding: 'Encoding',
  finalizing: 'Finalizing',
}

// Messages with no progress number — show animated dots + indeterminate bar
const INDETERMINATE_MESSAGES = new Set([
  'Starting…',
  'Loading conversion engine…',
  'Reading video…',
  'Analyzing video…',
])

export function ProgressTracker() {
  const { cancel } = useConversion()
  const progress = useConversionStore((s) => s.progress)

  const pct = progress?.percent ?? 0
  const stage = progress?.stage ?? 'decoding'
  const rawMessage = progress?.message ?? 'Starting…'
  const isLoadingEngine = stage === 'decoding' && !isFfmpegReady()
  const isIndeterminate = isLoadingEngine || INDETERMINATE_MESSAGES.has(rawMessage)

  // Strip trailing ellipsis — the CSS animated dots will replace it
  const messageBase = rawMessage.replace(/[…\.]+$/, '')

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">{STAGE_LABELS[stage]}</span>
          <span className="text-gray-500">{pct > 0 ? `${pct}%` : '…'}</span>
        </div>

        {/* Progress bar */}
        <div className="relative h-2.5 rounded-full bg-gray-200 overflow-hidden">
          {isLoadingEngine ? (
            /* Indeterminate bounce while engine loads */
            <div className="h-full w-2/5 rounded-full bg-indigo-400 animate-[slide_1.8s_ease-in-out_infinite]" />
          ) : (
            /* Determinate fill with shimmer overlay */
            <div
              className="relative h-full rounded-full bg-indigo-500 transition-all duration-500 overflow-hidden"
              style={{ width: `${Math.max(pct, 2)}%` }}
            >
              {/* Shimmer sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_1.6s_linear_infinite]" />
            </div>
          )}
        </div>

        {/* Message with animated dots */}
        <p className="text-xs text-gray-400">
          {isIndeterminate ? (
            <span className="animated-dots">{messageBase}</span>
          ) : (
            rawMessage
          )}
        </p>

        {isLoadingEngine && (
          <p className="text-xs text-amber-600">
            First-time setup — downloading ~30 MB, cached after this.
          </p>
        )}
      </div>

      {progress && progress.framesTotal > 0 && (
        <p className="text-xs text-gray-400">
          Frame {progress.framesProcessed} of {progress.framesTotal}
        </p>
      )}

      <button
        onClick={cancel}
        className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
      >
        Cancel
      </button>
    </div>
  )
}
