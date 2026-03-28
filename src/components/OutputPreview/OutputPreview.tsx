import { useEffect, useState } from 'react'
import { useConversionStore } from '../../store/conversionStore'

export function OutputPreview() {
  const result = useConversionStore((s) => s.result)
  const reset = useConversionStore((s) => s.reset)
  const backToSettings = useConversionStore((s) => s.backToSettings)
  const inputFile = useConversionStore((s) => s.inputFile)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!result) return
    const url = URL.createObjectURL(result.blob)
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
      setObjectUrl(null)
    }
  }, [result])

  if (!result || !objectUrl) return null

  const sizeMb = (result.outputSizeBytes / 1024 / 1024).toFixed(1)
  const durationSec = (result.durationMs / 1000).toFixed(1)
  const filename = (inputFile?.name ?? 'video').replace(/\.[^.]+$/, '') + '.gif'

  function download() {
    const a = document.createElement('a')
    a.href = objectUrl!
    a.download = filename
    a.click()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center">
        <img
          src={objectUrl}
          alt="Converted GIF preview"
          className="max-h-[400px] max-w-full object-contain"
        />
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {sizeMb} MB · converted in {durationSec}s
          {' · '}
          <span className={`font-medium ${result.path === 'fast' ? 'text-green-600' : 'text-yellow-600'}`}>
            {result.path === 'fast' ? 'GPU' : 'CPU'}
          </span>
        </span>
        <button
          onClick={reset}
          className="text-gray-400 hover:text-gray-600 transition-colors text-xs underline underline-offset-2"
        >
          Start over
        </button>
      </div>

      <button
        onClick={download}
        className="w-full py-3 px-6 rounded-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-semibold text-base transition-all shadow-sm"
      >
        Download GIF · {sizeMb} MB
      </button>

      <button
        onClick={backToSettings}
        className="w-full py-2.5 px-6 rounded-xl bg-white hover:bg-gray-50 active:scale-[0.98] text-gray-700 font-medium text-sm border border-gray-200 transition-all"
      >
        Adjust settings &amp; convert again
      </button>
    </div>
  )
}
