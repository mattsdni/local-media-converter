import { useConversionStore } from '../../store/conversionStore'

const ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  FILE_TOO_LARGE: {
    title: 'File too large',
    detail: 'This file is too large (max 500 MB). Try a shorter clip or lower resolution.',
  },
  DURATION_EXCEEDED: {
    title: 'Clip too long',
    detail: 'On mobile, clips are limited to 30 seconds. Use the trim controls.',
  },
  UNSUPPORTED_CODEC: {
    title: 'Unsupported video codec',
    detail: 'This video format is not supported. Try converting to H.264/MP4 first.',
  },
  WEBGPU_INIT_FAILED: {
    title: 'GPU initialization failed',
    detail: 'Could not initialize WebGPU. The app will retry using software mode.',
  },
  WASM_LOAD_FAILED: {
    title: 'Failed to load conversion engine',
    detail: 'Could not load ffmpeg.wasm. Check your connection and try again.',
  },
  OOM: {
    title: 'Out of memory',
    detail: 'The file is too large for your device. Try a shorter clip or lower resolution.',
  },
  UNKNOWN: {
    title: 'Conversion failed',
    detail: 'An unexpected error occurred. Please try again.',
  },
}

export function ErrorDisplay() {
  const error = useConversionStore((s) => s.error)
  const reset = useConversionStore((s) => s.reset)
  const setPhase = useConversionStore((s) => s.setInputFile)
  const inputFile = useConversionStore((s) => s.inputFile)
  const inputMetadata = useConversionStore((s) => s.inputMetadata)

  if (!error) return null

  const info = ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES.UNKNOWN

  function retry() {
    if (inputFile && inputMetadata) {
      // Go back to file-selected phase
      setPhase(inputFile, inputMetadata)
    } else {
      reset()
    }
  }

  return (
    <div className="space-y-4 p-5 rounded-xl bg-red-50 border border-red-200">
      <div>
        <h3 className="font-semibold text-red-800">{info.title}</h3>
        <p className="text-sm text-red-700 mt-1">{info.detail}</p>
        {error.message && error.message !== info.detail && (
          <p className="text-xs text-red-400 mt-2 font-mono">{error.message}</p>
        )}
      </div>
      <div className="flex gap-3">
        {error.recoverable && (
          <button
            onClick={retry}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg bg-white text-red-700 text-sm font-medium border border-red-200 hover:bg-red-50 transition-colors"
        >
          Start over
        </button>
      </div>
    </div>
  )
}
