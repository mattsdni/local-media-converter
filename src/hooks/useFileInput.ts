import { useRef, useCallback } from 'react'
import { useConversionStore } from '../store/conversionStore'
import type { VideoMetadata } from '../conversion/types'

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo']
const MAX_SIZE_BYTES = 500 * 1024 * 1024 // 500 MB

type RVFC = (cb: (now: number, meta: { mediaTime: number }) => void) => void

async function detectFps(video: HTMLVideoElement): Promise<number> {
  const rvfc: RVFC | undefined = (video as any).requestVideoFrameCallback?.bind(video)
  if (!rvfc) return 30
  const callRvfc: RVFC = rvfc

  return new Promise<number>((resolve) => {
    const times: number[] = []
    const SAMPLES = 6
    let done = false

    function finish() {
      if (done) return
      done = true
      video.pause()
      const intervals = times.slice(1).map((t, i) => t - times[i]).filter(d => d > 0)
      if (intervals.length === 0) { resolve(30); return }
      const avg = intervals.reduce((a, b) => a + b) / intervals.length
      resolve(Math.round(1 / avg))
    }

    function onFrame(_: number, meta: { mediaTime: number }) {
      times.push(meta.mediaTime)
      if (times.length >= SAMPLES) { finish(); return }
      callRvfc(onFrame)
    }

    rvfc(onFrame)
    video.muted = true
    video.play().catch(() => { done = true; resolve(30) })
    setTimeout(finish, 2000)
  })
}

async function readVideoMetadata(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = async () => {
      const fps = await detectFps(video)
      URL.revokeObjectURL(url)
      resolve({
        durationSec: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        fps,
      })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read video metadata'))
    }
    video.src = url
  })
}

export function useFileInput() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const setInputFile = useConversionStore((s) => s.setInputFile)

  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|avi)$/i)) {
      alert('Unsupported file type. Please choose an MP4, MOV, WebM, or AVI video.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      alert('File is too large (max 500 MB). Please choose a shorter clip.')
      return
    }
    try {
      const metadata = await readVideoMetadata(file)
      setInputFile(file, metadata)
    } catch {
      alert('Could not read video file. Please try a different file.')
    }
  }, [setInputFile])

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const onPickerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }, [handleFile])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return { fileInputRef, openPicker, onPickerChange, onDrop, onDragOver }
}
