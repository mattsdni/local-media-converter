import { useEffect } from 'react'
import { preloadFfmpeg } from '../conversion/fallback-path/FfmpegConverter'

/** Starts background WASM download on mount so it's ready before the user converts */
export function usePreload() {
  useEffect(() => {
    preloadFfmpeg()
  }, [])
}
