/// <reference lib="webworker" />
import { FFmpeg, FFFSType } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { ConversionOptions, ConversionProgress } from '../conversion/types'

type WorkerInput =
  | { type: 'preload' }
  | { type: 'convert'; file: File; options: ConversionOptions }
  | { type: 'cancel' }

type WorkerOutput =
  | { type: 'preloaded' }
  | { type: 'progress'; data: ConversionProgress }
  | { type: 'complete'; buffer: ArrayBuffer }
  | { type: 'error'; code: string; message: string }

const ffmpeg = new FFmpeg()
let loadPromise: Promise<boolean> | null = null
let cancelled = false

const FFMPEG_CDN = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'

function loadFfmpeg(): Promise<boolean> {
  if (loadPromise) return loadPromise
  loadPromise = Promise.all([
    toBlobURL(`${FFMPEG_CDN}/ffmpeg-core.js`, 'text/javascript'),
    toBlobURL(`${FFMPEG_CDN}/ffmpeg-core.wasm`, 'application/wasm'),
  ])
    .then(([coreURL, wasmURL]) => ffmpeg.load({ coreURL, wasmURL }))
    .catch((err) => {
      loadPromise = null
      throw err
    })
  return loadPromise
}

// --- Log-based progress parsing ---
// FFmpeg logs "Duration: HH:MM:SS.ss" once at startup and
// "time=HH:MM:SS.ss" every ~0.5s during processing.
// We use these to synthesise progress across both palette passes.

function parseHMS(h: string, m: string, s: string, cs: string): number {
  return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + parseInt(cs) / 100
}

function parseDuration(msg: string): number | null {
  const match = msg.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
  return match ? parseHMS(match[1], match[2], match[3], match[4]) : null
}

function parseCurrentTime(msg: string): number | null {
  const match = msg.match(/time=\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/)
  return match ? parseHMS(match[1], match[2], match[3], match[4]) : null
}

function makeLogProgressHandler(onProgress: (pct: number, msg: string) => void) {
  let totalDuration: number | null = null
  let lastTime = 0
  let pass = 0           // 0 = palettegen, 1 = paletteuse/encode
  let lastSentPct = 12

  // Pass 0 maps to 12–51%, pass 1 maps to 52–93%
  const PASS_BASE = [12, 52]
  const PASS_RANGE = [39, 41]
  const PASS_LABELS = ['Analyzing video', 'Encoding GIF']

  return ({ message }: { message: string }) => {
    if (!totalDuration) {
      const d = parseDuration(message)
      if (d && d > 0) totalDuration = d
    }

    const t = parseCurrentTime(message)
    if (t === null || !totalDuration) return

    // Time reset → FFmpeg started a new pass
    if (t < lastTime - 1) {
      pass = Math.min(pass + 1, 1)
      lastTime = 0
    }
    lastTime = t

    const passProgress = Math.min(t / totalDuration, 1)
    const pct = Math.round(PASS_BASE[pass] + passProgress * PASS_RANGE[pass])

    if (pct > lastSentPct) {
      lastSentPct = pct
      onProgress(pct, `${PASS_LABELS[pass]}… ${pct}%`)
    }
  }
}

// ---

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const msg = e.data

  if (msg.type === 'preload') {
    try {
      await loadFfmpeg()
      send({ type: 'preloaded' })
    } catch {
      // Non-fatal — convert will retry
    }
    return
  }

  if (msg.type === 'cancel') {
    cancelled = true
    ffmpeg.terminate()
    loadPromise = null
    return
  }

  if (msg.type === 'convert') {
    cancelled = false
    const { file, options } = msg

    try {
      send(progress(5, 'decoding', 'Loading conversion engine…'))
      await loadFfmpeg()
      if (cancelled) return

      send(progress(10, 'decoding', 'Reading video…'))

      // Mount file with WORKERFS (zero-copy). Falls back to writeFile.
      const mountDir = '/input'
      let inputPath: string
      let usedMount = false

      try {
        await ffmpeg.createDir(mountDir)
        await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, mountDir)
        inputPath = `${mountDir}/${file.name}`
        usedMount = true
      } catch {
        const ext = file.name.split('.').pop() ?? 'mp4'
        inputPath = `input.${ext}`
        await ffmpeg.writeFile(inputPath, await fetchFile(file))
      }

      if (cancelled) return

      // Log-based progress covers both FFmpeg passes
      const logHandler = makeLogProgressHandler((pct, message) => {
        if (cancelled) return
        const stage = pct < 52 ? 'processing' : 'encoding'
        send(progress(pct, stage, message))
      })
      ffmpeg.on('log', logHandler)

      send(progress(12, 'processing', 'Analyzing video…'))

      const args: string[] = ['-i', inputPath]
      if (options.startTime != null) args.push('-ss', String(options.startTime))
      if (options.endTime != null) args.push('-to', String(options.endTime))
      args.push('-vf', buildFilterComplex(options), '-loop', '0', 'output.gif')

      await ffmpeg.exec(args)
      ffmpeg.off('log', logHandler)

      if (cancelled) return

      send(progress(95, 'finalizing', 'Finalizing…'))

      const data = await ffmpeg.readFile('output.gif')
      const buffer = (data as Uint8Array).buffer.slice(0) as ArrayBuffer

      await ffmpeg.deleteFile('output.gif')
      if (usedMount) {
        await ffmpeg.unmount(mountDir)
        await ffmpeg.deleteDir(mountDir)
      } else {
        await ffmpeg.deleteFile(inputPath)
      }

      self.postMessage({ type: 'complete', buffer } satisfies WorkerOutput, { transfer: [buffer] })
    } catch (err) {
      if (cancelled) return
      const message = err instanceof Error ? err.message : 'Unknown error'
      send({ type: 'error', code: 'UNKNOWN', message })
    }
  }
}

function progress(
  percent: number,
  stage: ConversionProgress['stage'],
  message: string,
): WorkerOutput {
  return {
    type: 'progress',
    data: { stage, framesTotal: 0, framesProcessed: 0, percent, message },
  }
}

function ditherToFfmpeg(dither: ConversionOptions['dither']): string {
  switch (dither) {
    case 'floyd-steinberg': return 'sierra2_4a'
    case 'bayer': return 'bayer:bayer_scale=2'
    case 'none': return 'bayer:bayer_scale=0'
  }
}

function buildFilterComplex(options: ConversionOptions): string {
  const scale = options.scale > 0 ? `scale=${options.scale}:-1:flags=lanczos` : 'scale=iw:ih'
  const dither = ditherToFfmpeg(options.dither)
  return `fps=${options.fps},${scale},split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=${dither}`
}

function send(msg: WorkerOutput) {
  self.postMessage(msg)
}
