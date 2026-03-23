import { useState } from 'react'
import { useFileInput } from '../../hooks/useFileInput'
import { useConversionStore } from '../../store/conversionStore'

export function DropZone() {
  const { fileInputRef, openPicker, onPickerChange, onDrop, onDragOver } = useFileInput()
  const [isDragging, setIsDragging] = useState(false)
  const inputFile = useConversionStore((s) => s.inputFile)
  const inputMetadata = useConversionStore((s) => s.inputMetadata)
  const reset = useConversionStore((s) => s.reset)

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = (e: React.DragEvent) => { setIsDragging(false); onDrop(e) }

  if (inputFile && inputMetadata) {
    const durationStr = inputMetadata.durationSec < 60
      ? `${Math.round(inputMetadata.durationSec)}s`
      : `${Math.floor(inputMetadata.durationSec / 60)}m ${Math.round(inputMetadata.durationSec % 60)}s`

    return (
      <div className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-gray-50">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-xl">
          🎬
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{inputFile.name}</p>
          <p className="text-sm text-gray-500">
            {inputMetadata.width} × {inputMetadata.height} · {durationStr} · {(inputFile.size / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
        <button
          onClick={reset}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors px-2 py-1 rounded"
        >
          Change
        </button>
      </div>
    )
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-msvideo,.mp4,.mov,.webm,.avi"
        className="hidden"
        onChange={onPickerChange}
      />
      <div
        onClick={openPicker}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={onDragOver}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center gap-3 p-12 rounded-2xl border-2 border-dashed
          cursor-pointer transition-all select-none
          ${isDragging
            ? 'border-indigo-400 bg-indigo-50 scale-[1.01]'
            : 'border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50'
          }
        `}
      >
        <div className="text-4xl">🎬</div>
        <div className="text-center">
          <p className="font-semibold text-gray-700">Drop a video here</p>
          <p className="text-sm text-gray-400 mt-1">or click to browse · MP4, MOV, WebM, AVI</p>
        </div>
      </div>
    </>
  )
}
