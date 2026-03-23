import type {
  ConverterBackend,
  ConversionOptions,
  ConversionProgress,
  ConversionResult,
  ConversionError,
} from '../types'

// Singleton worker — persists for the app lifetime so WASM is only loaded once
let sharedWorker: Worker | null = null
let engineReady = false

function getWorker(): Worker {
  if (!sharedWorker) {
    sharedWorker = new Worker(
      new URL('../../workers/ffmpeg.worker.ts', import.meta.url),
      { type: 'module' },
    )
    sharedWorker.onmessage = (e) => {
      if (e.data?.type === 'preloaded') engineReady = true
    }
  }
  return sharedWorker
}

/** Call once on app mount to start background WASM download */
export function preloadFfmpeg(): void {
  const worker = getWorker()
  worker.postMessage({ type: 'preload' })
}

export function isFfmpegReady(): boolean {
  return engineReady
}

export class FfmpegConverter implements ConverterBackend {
  async convert(
    file: File,
    options: ConversionOptions,
    onProgress: (p: ConversionProgress) => void,
    signal: AbortSignal,
  ): Promise<ConversionResult> {
    const start = Date.now()
    const worker = getWorker()

    return new Promise<ConversionResult>((resolve, reject) => {
      // Main-thread timer provides smooth fake progress while the worker is blocked
      // running the two-pass FFmpeg palette filter (no real events fire during pass 1).
      let fakePct = 12
      const fakeTimer = setInterval(() => {
        fakePct = Math.min(fakePct + 1, 88)
        onProgress({
          stage: fakePct < 52 ? 'processing' : 'encoding',
          framesTotal: 0,
          framesProcessed: 0,
          percent: fakePct,
          message: `${fakePct < 52 ? 'Analyzing video' : 'Encoding GIF'}… ${fakePct}%`,
        })
      }, 1000)

      const cleanup = () => {
        clearInterval(fakeTimer)
        signal.removeEventListener('abort', onAbort)
      }

      const onAbort = () => {
        cleanup()
        worker.postMessage({ type: 'cancel' })
        // Worker will be recreated next time since cancel calls ffmpeg.terminate()
        sharedWorker = null
        engineReady = false
        reject({ code: 'CANCELLED', message: 'Cancelled', recoverable: false } satisfies ConversionError)
      }
      signal.addEventListener('abort', onAbort, { once: true })

      worker.onmessage = (e) => {
        const msg = e.data
        if (msg.type === 'preloaded') {
          engineReady = true
        } else if (msg.type === 'progress') {
          // Worker log events batch and fire all at once after exec() — only forward
          // events that advance progress to avoid the jumpy flood causing regression
          if (msg.data.percent > fakePct) {
            clearInterval(fakeTimer)
            fakePct = msg.data.percent
            onProgress(msg.data)
          }
        } else if (msg.type === 'complete') {
          cleanup()
          const blob = new Blob([msg.buffer], { type: 'image/gif' })
          resolve({
            blob,
            durationMs: Date.now() - start,
            frameCount: 0,
            outputSizeBytes: blob.size,
            path: 'fallback',
          })
        } else if (msg.type === 'error') {
          cleanup()
          reject({
            code: msg.code ?? 'UNKNOWN',
            message: msg.message,
            recoverable: true,
          } satisfies ConversionError)
        }
      }

      worker.onerror = (err) => {
        cleanup()
        reject({
          code: 'WASM_LOAD_FAILED',
          message: err.message,
          recoverable: true,
        } satisfies ConversionError)
      }

      worker.postMessage({ type: 'convert', file, options })
    })
  }

  dispose() {
    // Don't terminate the shared worker — it will be reused
  }
}
