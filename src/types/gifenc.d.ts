declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(
      indexedPixels: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: Uint8Array; delay?: number; repeat?: number; transparent?: number }
    ): void
    finish(): void
    bytesView(): Uint8Array
    bytes(): Uint8Array
  }

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): GIFEncoderInstance
  export function quantize(rgba: Uint8ClampedArray | Uint8Array, maxColors: number, opts?: Record<string, unknown>): Uint8Array
  export function applyPalette(rgba: Uint8ClampedArray | Uint8Array, palette: Uint8Array, opts?: Record<string, unknown>): Uint8Array
}
