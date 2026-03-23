import { useRef, useCallback } from 'react'
import { useConversionStore } from '../store/conversionStore'
import { createConverter } from '../conversion/pipeline'
import type { ConverterBackend, ConversionError } from '../conversion/types'

export function useConversion() {
  const converterRef = useRef<ConverterBackend | null>(null)

  const capability = useConversionStore((s) => s.capability)
  const inputFile = useConversionStore((s) => s.inputFile)
  const options = useConversionStore((s) => s.options)
  const startConversion = useConversionStore((s) => s.startConversion)
  const updateProgress = useConversionStore((s) => s.updateProgress)
  const completeConversion = useConversionStore((s) => s.completeConversion)
  const failConversion = useConversionStore((s) => s.failConversion)
  const cancelConversion = useConversionStore((s) => s.cancelConversion)

  const convert = useCallback(async () => {
    if (!inputFile || !capability) return

    const controller = new AbortController()
    startConversion(controller)

    try {
      if (!converterRef.current) {
        converterRef.current = createConverter(capability)
      }
      const result = await converterRef.current.convert(
        inputFile,
        options,
        updateProgress,
        controller.signal,
      )
      completeConversion(result)
    } catch (err) {
      failConversion(err as ConversionError)
    }
  }, [inputFile, capability, options, startConversion, updateProgress, completeConversion, failConversion])

  const cancel = useCallback(() => {
    // Disposing resets the shared worker; a new one will be created next time
    converterRef.current?.dispose()
    converterRef.current = null
    cancelConversion()
  }, [cancelConversion])

  return { convert, cancel }
}
