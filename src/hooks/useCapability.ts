import { useEffect } from 'react'
import { detectCapabilities } from '../conversion/capability'
import { useConversionStore } from '../store/conversionStore'

export function useCapability() {
  const setCapability = useConversionStore((s) => s.setCapability)
  const capability = useConversionStore((s) => s.capability)

  useEffect(() => {
    detectCapabilities().then(setCapability)
  }, [setCapability])

  return capability
}
