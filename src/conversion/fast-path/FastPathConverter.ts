import type {
  ConverterBackend,
  ConversionOptions,
  ConversionProgress,
  ConversionResult,
  ConversionError,
} from '../types'

export class FastPathConverter implements ConverterBackend {
  private worker: Worker | null = null

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../../workers/fast-path.worker.ts', import.meta.url),
        { type: 'module' },
      )
    }
    return this.worker
  }

  async convert(
    file: File,
    options: ConversionOptions,
    onProgress: (p: ConversionProgress) => void,
    signal: AbortSignal,
  ): Promise<ConversionResult> {
    const start = Date.now()
    const worker = this.getWorker()

    return new Promise<ConversionResult>((resolve, reject) => {
      const onAbort = () => {
        worker.postMessage({ type: 'cancel' })
        reject({ code: 'CANCELLED', message: 'Cancelled', recoverable: false } satisfies ConversionError)
      }
      signal.addEventListener('abort', onAbort, { once: true })

      worker.onmessage = (e) => {
        const msg = e.data
        if (msg.type === 'progress') {
          onProgress(msg.data)
        } else if (msg.type === 'complete') {
          signal.removeEventListener('abort', onAbort)
          const blob = new Blob([msg.buffer], { type: 'image/gif' })
          resolve({
            blob,
            durationMs: Date.now() - start,
            frameCount: 0,
            outputSizeBytes: blob.size,
            path: 'fast',
          })
        } else if (msg.type === 'error') {
          signal.removeEventListener('abort', onAbort)
          reject({
            code: msg.code ?? 'UNKNOWN',
            message: msg.message,
            recoverable: true,
          } satisfies ConversionError)
        }
      }

      worker.onerror = (err) => {
        signal.removeEventListener('abort', onAbort)
        reject({
          code: 'WEBGPU_INIT_FAILED',
          message: err.message,
          recoverable: true,
        } satisfies ConversionError)
      }

      worker.postMessage({ type: 'convert', file, options })
    })
  }

  dispose() {
    this.worker?.terminate()
    this.worker = null
  }
}
