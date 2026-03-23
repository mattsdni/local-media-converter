import { useCapability } from './hooks/useCapability'
import { usePreload } from './hooks/usePreload'
import { useConversionStore } from './store/conversionStore'
import { CapabilityBanner } from './components/CapabilityBanner/CapabilityBanner'
import { DropZone } from './components/DropZone/DropZone'
import { ConversionPanel } from './components/ConversionPanel/ConversionPanel'
import { ProgressTracker } from './components/ProgressTracker/ProgressTracker'
import { OutputPreview } from './components/OutputPreview/OutputPreview'
import { ErrorDisplay } from './components/ErrorDisplay/ErrorDisplay'

function App() {
  const capability = useCapability()
  const phase = useConversionStore((s) => s.phase)
  usePreload()

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center py-10 px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">GIF Converter</h1>
          <p className="text-gray-500 text-sm">Convert videos to GIF, entirely in your browser</p>
        </div>

        {/* Capability banner */}
        <CapabilityBanner capability={capability} />

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Always show drop zone so user knows what file is loaded */}
          <DropZone />

          {/* Phase-based content */}
          {phase === 'file-selected' && <ConversionPanel />}
          {phase === 'converting' && <ProgressTracker />}
          {phase === 'complete' && <OutputPreview />}
          {phase === 'error' && <ErrorDisplay />}
        </div>
      </div>
    </div>
  )
}

export default App
