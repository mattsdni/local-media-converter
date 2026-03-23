import { useConversionStore } from '../../store/conversionStore'
import type { ConversionOptions } from '../../conversion/types'

const SCALE_OPTIONS = [
  { label: '240px', value: 240 },
  { label: '320px', value: 320 },
  { label: '480px', value: 480 },
  { label: '640px', value: 640 },
  { label: '720px', value: 720 },
  { label: 'Original', value: -1 },
]

export function ConversionSettings() {
  const options = useConversionStore((s) => s.options)
  const updateOptions = useConversionStore((s) => s.updateOptions)
  const capability = useConversionStore((s) => s.capability)
  const inputMetadata = useConversionStore((s) => s.inputMetadata)

  function set<K extends keyof ConversionOptions>(key: K, value: ConversionOptions[K]) {
    updateOptions({ [key]: value })
  }

  const showTrim = inputMetadata && inputMetadata.durationSec > 2

  return (
    <div className="space-y-5">
      {/* FPS */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <label className="font-medium text-gray-700">Frame rate</label>
          <span className="text-gray-500">{options.fps} fps</span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          value={options.fps}
          onChange={(e) => set('fps', Number(e.target.value))}
          className="w-full accent-indigo-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>1 (smaller file)</span>
          <span>30 (smoother)</span>
        </div>
      </div>

      {/* Scale */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Output width</label>
        <div className="flex flex-wrap gap-2">
          {SCALE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set('scale', opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                options.scale === opt.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dither */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Dithering</label>
        <div className="flex gap-2">
          {(['none', 'bayer', 'floyd-steinberg'] as const).map((d) => {
            // Floyd-Steinberg only available in fallback path in v1
            const disabled = d === 'floyd-steinberg' && capability?.path === 'fast'
            return (
              <button
                key={d}
                onClick={() => !disabled && set('dither', d)}
                disabled={disabled}
                title={disabled ? 'Floyd-Steinberg dithering coming soon for GPU mode' : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                  options.dither === d
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : disabled
                    ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {d}
              </button>
            )
          })}
        </div>
      </div>

      {/* Trim */}
      {showTrim && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Trim <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-500">From</span>
              <input
                type="number"
                min={0}
                max={inputMetadata.durationSec}
                step={0.1}
                placeholder="0"
                value={options.startTime ?? ''}
                onChange={(e) => set('startTime', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <span className="text-sm text-gray-500">s</span>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-sm text-gray-500">To</span>
              <input
                type="number"
                min={0}
                max={inputMetadata.durationSec}
                step={0.1}
                placeholder={String(Math.round(inputMetadata.durationSec))}
                value={options.endTime ?? ''}
                onChange={(e) => set('endTime', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <span className="text-sm text-gray-500">s</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
