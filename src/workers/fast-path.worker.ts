/// <reference lib="webworker" />
import { GIFEncoder } from 'gifenc'
import resizeWGSL from '../shaders/resize.wgsl'
import paletteGenWGSL from '../shaders/palette-gen.wgsl'
import ditherWGSL from '../shaders/dither.wgsl'
import type { ConversionOptions, ConversionProgress } from '../conversion/types'

type WorkerInput =
  | { type: 'convert'; file: File; options: ConversionOptions }
  | { type: 'cancel' }

type WorkerOutput =
  | { type: 'progress'; data: ConversionProgress }
  | { type: 'complete'; buffer: ArrayBuffer }
  | { type: 'error'; code: string; message: string }

let cancelled = false

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  if (e.data.type === 'cancel') {
    cancelled = true
    return
  }
  if (e.data.type === 'convert') {
    cancelled = false
    const { file, options } = e.data
    try {
      const buffer = await convertVideoToGif(file, options)
      self.postMessage({ type: 'complete', buffer } satisfies WorkerOutput, { transfer: [buffer] })
    } catch (err) {
      if (cancelled) return
      const message = err instanceof Error ? err.message : String(err)
      const code = (err as { code?: string }).code ?? 'UNKNOWN'
      self.postMessage({ type: 'error', code, message } satisfies WorkerOutput)
    }
  }
}

function send(msg: WorkerOutput) {
  self.postMessage(msg)
}

async function convertVideoToGif(file: File, options: ConversionOptions): Promise<ArrayBuffer> {
  send({ type: 'progress', data: { stage: 'decoding', framesTotal: 0, framesProcessed: 0, percent: 2, message: 'Initializing GPU…' } })

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) throw { code: 'WEBGPU_INIT_FAILED', message: 'No WebGPU adapter available' }
  const device = await adapter.requestDevice()

  send({ type: 'progress', data: { stage: 'decoding', framesTotal: 0, framesProcessed: 0, percent: 5, message: 'Decoding video…' } })

  const frames = await decodeFrames(file, options)
  if (cancelled) { device.destroy(); return new ArrayBuffer(0) }

  const totalFrames = frames.length
  if (totalFrames === 0) throw { code: 'UNKNOWN', message: 'No frames decoded from video' }

  const srcW = frames[0].width
  const srcH = frames[0].height
  let dstW: number, dstH: number
  if (options.scale > 0) {
    const ratio = Math.min(options.scale / srcW, options.scale / srcH)
    dstW = Math.round(srcW * ratio)
    dstH = Math.round(srcH * ratio)
  } else {
    dstW = srcW
    dstH = srcH
  }

  send({ type: 'progress', data: { stage: 'processing', framesTotal: totalFrames, framesProcessed: 0, percent: 10, message: 'Building color palette…' } })

  const palette = await buildGlobalPalette(device, frames, dstW, dstH)
  if (cancelled) { device.destroy(); return new ArrayBuffer(0) }

  send({ type: 'progress', data: { stage: 'encoding', framesTotal: totalFrames, framesProcessed: 0, percent: 30, message: 'Encoding GIF…' } })

  const gif = GIFEncoder()
  const frameDelay = Math.round(100 / options.fps)

  for (let i = 0; i < frames.length; i++) {
    if (cancelled) { device.destroy(); return new ArrayBuffer(0) }

    const indexData = await processFrame(device, frames[i], palette, dstW, dstH, options)
    frames[i].close()

    gif.writeFrame(indexData, dstW, dstH, { palette, delay: frameDelay })

    const pct = Math.round(30 + (i / totalFrames) * 65)
    send({ type: 'progress', data: { stage: 'encoding', framesTotal: totalFrames, framesProcessed: i + 1, percent: pct, message: `Encoding frame ${i + 1} / ${totalFrames}` } })
  }

  send({ type: 'progress', data: { stage: 'finalizing', framesTotal: totalFrames, framesProcessed: totalFrames, percent: 96, message: 'Finalizing…' } })

  gif.finish()
  device.destroy()
  const bytes = gif.bytesView()
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

// In v1, the fast path requires mp4box for proper demuxing.
// We throw to trigger auto-fallback to ffmpeg.wasm.
// This will be replaced with a proper WebCodecs + mp4box implementation.
async function decodeFrames(_file: File, _options: ConversionOptions): Promise<ImageBitmap[]> {
  throw { code: 'UNSUPPORTED_CODEC', message: 'Fast path requires mp4box demuxer (coming in v1.1) — using fallback' }
}

async function buildGlobalPalette(
  device: GPUDevice,
  frames: ImageBitmap[],
  dstW: number,
  dstH: number,
): Promise<Uint8Array> {
  const HISTOGRAM_SIZE = 4096
  const histogramBuffer = device.createBuffer({
    size: HISTOGRAM_SIZE * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })

  const zeroData = new Uint32Array(HISTOGRAM_SIZE)
  device.queue.writeBuffer(histogramBuffer, 0, zeroData)

  const resizePipeline = await createResizePipeline(device)
  const palettePipeline = await createPalettePipeline(device)

  const sampleFrames = frames.filter((_, i) => i % 3 === 0)

  for (const frame of sampleFrames) {
    if (cancelled) break
    const resized = await resizeFrame(device, resizePipeline, frame, dstW, dstH)
    await accumulateHistogram(device, palettePipeline, resized, histogramBuffer)
    resized.destroy()
  }

  const readBuffer = device.createBuffer({
    size: HISTOGRAM_SIZE * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })
  const cmd = device.createCommandEncoder()
  cmd.copyBufferToBuffer(histogramBuffer, 0, readBuffer, 0, HISTOGRAM_SIZE * 4)
  device.queue.submit([cmd.finish()])
  await readBuffer.mapAsync(GPUMapMode.READ)
  const histogram = new Uint32Array(readBuffer.getMappedRange().slice(0))
  readBuffer.unmap()
  readBuffer.destroy()
  histogramBuffer.destroy()

  return selectPaletteFromHistogram(histogram, 256)
}

function selectPaletteFromHistogram(histogram: Uint32Array, maxColors: number): Uint8Array {
  const entries: Array<{ count: number; r: number; g: number; b: number }> = []
  for (let i = 0; i < 4096; i++) {
    if (histogram[i] === 0) continue
    const r = Math.round((i >> 8) * (255 / 15))
    const g = Math.round(((i >> 4) & 0xf) * (255 / 15))
    const b = Math.round((i & 0xf) * (255 / 15))
    entries.push({ count: histogram[i], r, g, b })
  }
  entries.sort((a, b) => b.count - a.count)

  const colors = entries.slice(0, maxColors)
  while (colors.length < maxColors) {
    colors.push({ count: 0, r: 0, g: 0, b: 0 })
  }

  const palette = new Uint8Array(maxColors * 3)
  for (let i = 0; i < maxColors; i++) {
    palette[i * 3] = colors[i].r
    palette[i * 3 + 1] = colors[i].g
    palette[i * 3 + 2] = colors[i].b
  }
  return palette
}

async function processFrame(
  device: GPUDevice,
  frame: ImageBitmap,
  palette: Uint8Array,
  dstW: number,
  dstH: number,
  options: ConversionOptions,
): Promise<Uint8Array> {
  const resizePipeline = await createResizePipeline(device)
  const resizedTexture = await resizeFrame(device, resizePipeline, frame, dstW, dstH)

  const paletteCount = palette.length / 3
  const paletteData = new Float32Array(paletteCount * 4)
  for (let i = 0; i < paletteCount; i++) {
    paletteData[i * 4] = palette[i * 3] / 255
    paletteData[i * 4 + 1] = palette[i * 3 + 1] / 255
    paletteData[i * 4 + 2] = palette[i * 3 + 2] / 255
    paletteData[i * 4 + 3] = 1
  }
  const paletteBuffer = device.createBuffer({
    size: paletteData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(paletteBuffer, 0, paletteData)

  const indexBuffer = device.createBuffer({
    size: dstW * dstH * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  })

  const paramsData = new Uint32Array([dstW, dstH, paletteCount, 0])
  const paramsDataF = new Float32Array(paramsData.buffer)
  paramsDataF[3] = options.dither === 'none' ? 0 : 1

  const paramsBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(paramsBuffer, 0, paramsData.buffer)

  const ditherModule = device.createShaderModule({ code: ditherWGSL })
  const ditherPipeline = await device.createComputePipelineAsync({
    layout: 'auto',
    compute: { module: ditherModule, entryPoint: 'main' },
  })

  const bindGroup = device.createBindGroup({
    layout: ditherPipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: resizedTexture.createView() },
      { binding: 1, resource: { buffer: paletteBuffer } },
      { binding: 2, resource: { buffer: indexBuffer } },
      { binding: 3, resource: { buffer: paramsBuffer } },
    ],
  })

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(ditherPipeline)
  pass.setBindGroup(0, bindGroup)
  pass.dispatchWorkgroups(Math.ceil(dstW / 8), Math.ceil(dstH / 8))
  pass.end()

  const readBuffer = device.createBuffer({
    size: dstW * dstH * 4,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  })
  encoder.copyBufferToBuffer(indexBuffer, 0, readBuffer, 0, dstW * dstH * 4)
  device.queue.submit([encoder.finish()])

  await readBuffer.mapAsync(GPUMapMode.READ)
  const rawIndices = new Uint32Array(readBuffer.getMappedRange().slice(0))
  readBuffer.unmap()

  const u8Indices = new Uint8Array(dstW * dstH)
  for (let i = 0; i < rawIndices.length; i++) {
    u8Indices[i] = rawIndices[i] & 0xff
  }

  readBuffer.destroy()
  indexBuffer.destroy()
  paletteBuffer.destroy()
  paramsBuffer.destroy()
  resizedTexture.destroy()

  return u8Indices
}

let _resizePipeline: GPUComputePipeline | null = null
async function createResizePipeline(device: GPUDevice): Promise<GPUComputePipeline> {
  if (_resizePipeline) return _resizePipeline
  const module = device.createShaderModule({ code: resizeWGSL })
  _resizePipeline = await device.createComputePipelineAsync({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  })
  return _resizePipeline
}

let _palettePipeline: GPUComputePipeline | null = null
async function createPalettePipeline(device: GPUDevice): Promise<GPUComputePipeline> {
  if (_palettePipeline) return _palettePipeline
  const module = device.createShaderModule({ code: paletteGenWGSL })
  _palettePipeline = await device.createComputePipelineAsync({
    layout: 'auto',
    compute: { module, entryPoint: 'main' },
  })
  return _palettePipeline
}

async function resizeFrame(
  device: GPUDevice,
  pipeline: GPUComputePipeline,
  frame: ImageBitmap,
  dstW: number,
  dstH: number,
): Promise<GPUTexture> {
  const srcTexture = device.createTexture({
    size: [frame.width, frame.height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  })
  device.queue.copyExternalImageToTexture(
    { source: frame },
    { texture: srcTexture },
    [frame.width, frame.height],
  )

  const dstTexture = device.createTexture({
    size: [dstW, dstH],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
  })

  const paramsData = new Float32Array([frame.width, frame.height, dstW, dstH])
  const paramsBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  })
  device.queue.writeBuffer(paramsBuffer, 0, paramsData)

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: srcTexture.createView() },
      { binding: 1, resource: dstTexture.createView() },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  })

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.dispatchWorkgroups(Math.ceil(dstW / 8), Math.ceil(dstH / 8))
  pass.end()
  device.queue.submit([encoder.finish()])
  await device.queue.onSubmittedWorkDone()

  srcTexture.destroy()
  paramsBuffer.destroy()
  return dstTexture
}

async function accumulateHistogram(
  device: GPUDevice,
  pipeline: GPUComputePipeline,
  texture: GPUTexture,
  histogramBuffer: GPUBuffer,
): Promise<void> {
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: texture.createView() },
      { binding: 1, resource: { buffer: histogramBuffer } },
    ],
  })

  const encoder = device.createCommandEncoder()
  const pass = encoder.beginComputePass()
  pass.setPipeline(pipeline)
  pass.setBindGroup(0, bindGroup)
  pass.dispatchWorkgroups(Math.ceil(texture.width / 8), Math.ceil(texture.height / 8))
  pass.end()
  device.queue.submit([encoder.finish()])
  await device.queue.onSubmittedWorkDone()
}
