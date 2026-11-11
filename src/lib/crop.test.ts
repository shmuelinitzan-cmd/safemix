import { describe, expect, it } from 'vitest'
import { cropAndWhiten } from './crop.ts'

// A tiny picture: grey (245) background with a 4x2 black "molecule" at x=10..13, y=20..21.
function picture(w = 40, h = 40) {
  const d = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) d.set([245, 245, 245, 255], i * 4)
  for (let y = 20; y <= 21; y++) for (let x = 10; x <= 13; x++) d.set([0, 0, 0, 255], (y * w + x) * 4)
  return d
}

describe('cropAndWhiten', () => {
  it('cuts to the drawing plus padding', () => {
    const r = cropAndWhiten(picture(), 40, 40)!
    expect(r.width).toBe(4 + 2 * 8) // minimum padding 8 px each side
    expect(r.height).toBe(2 + 2 * 8)
  })
  it('keeps the drawing and turns the grey background white', () => {
    const r = cropAndWhiten(picture(), 40, 40)!
    const px = (x: number, y: number) => Array.from(r.data.slice((y * r.width + x) * 4, (y * r.width + x) * 4 + 4))
    expect(px(0, 0)).toEqual([255, 255, 255, 255]) // was grey
    expect(px(8, 8)).toEqual([0, 0, 0, 255]) // first drawn pixel
  })
  it('never cuts outside the picture', () => {
    const d = picture(40, 40)
    d.set([0, 0, 0, 255], 0 + 4 * (1 * 40 + 1)) // drawing near the corner
    const r = cropAndWhiten(d, 40, 40)!
    expect(r.width).toBeLessThanOrEqual(40)
    expect(r.height).toBeLessThanOrEqual(40)
  })
  it('returns null for a blank picture', () => {
    const d = new Uint8ClampedArray(10 * 10 * 4).fill(245)
    expect(cropAndWhiten(d, 10, 10)).toBeNull()
  })
})
