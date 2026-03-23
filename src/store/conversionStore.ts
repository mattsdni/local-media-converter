import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CapabilityReport,
  ConversionOptions,
  ConversionProgress,
  ConversionResult,
  ConversionError,
  VideoMetadata,
} from '../conversion/types'

export type AppPhase = 'idle' | 'file-selected' | 'converting' | 'complete' | 'error'

const defaultOptions: ConversionOptions = {
  fps: 10,
  scale: 480,
  quality: 7,
  dither: 'bayer',
}

interface ConversionState {
  capability: CapabilityReport | null
  inputFile: File | null
  inputMetadata: VideoMetadata | null
  options: ConversionOptions
  phase: AppPhase
  progress: ConversionProgress | null
  result: ConversionResult | null
  error: ConversionError | null
  abortController: AbortController | null

  setCapability: (cap: CapabilityReport) => void
  setInputFile: (file: File, metadata: VideoMetadata) => void
  updateOptions: (partial: Partial<ConversionOptions>) => void
  startConversion: (controller: AbortController) => void
  updateProgress: (p: ConversionProgress) => void
  completeConversion: (r: ConversionResult) => void
  failConversion: (e: ConversionError) => void
  cancelConversion: () => void
  reset: () => void
}

export const useConversionStore = create<ConversionState>()(
  persist(
    (set, get) => ({
      capability: null,
      inputFile: null,
      inputMetadata: null,
      options: defaultOptions,
      phase: 'idle',
      progress: null,
      result: null,
      error: null,
      abortController: null,

      setCapability: (cap) => set({ capability: cap }),

      setInputFile: (file, metadata) =>
        set({ inputFile: file, inputMetadata: metadata, phase: 'file-selected', result: null, error: null }),

      updateOptions: (partial) =>
        set((s) => ({ options: { ...s.options, ...partial } })),

      startConversion: (controller) =>
        set({ phase: 'converting', progress: null, error: null, abortController: controller }),

      updateProgress: (p) => set({ progress: p }),

      completeConversion: (r) =>
        set({ phase: 'complete', result: r, progress: null, abortController: null }),

      failConversion: (e) => {
        const { abortController } = get()
        if (e.code === 'CANCELLED') {
          set({ phase: 'file-selected', progress: null, error: null, abortController: null })
        } else {
          set({ phase: 'error', error: e, progress: null, abortController: null })
        }
        abortController?.abort()
      },

      cancelConversion: () => {
        const { abortController } = get()
        abortController?.abort()
        set({ phase: 'file-selected', progress: null, error: null, abortController: null })
      },

      reset: () =>
        set({
          inputFile: null,
          inputMetadata: null,
          phase: 'idle',
          progress: null,
          result: null,
          error: null,
          abortController: null,
        }),
    }),
    {
      name: 'media-converter-options',
      // Only persist user options, not runtime state
      partialize: (s) => ({ options: s.options }),
    },
  ),
)
