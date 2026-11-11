// Trims the empty margin around a PubChem structure picture, for display only.
// PubChem draws the molecule small in the middle of a light-grey square (245,245,245).
// We find the box that holds the drawing, cut to it (plus a little padding) and turn the
// grey background white so it sits cleanly on the white card. The stored PNG is not changed.

export interface Cropped {
  data: Uint8ClampedArray
  width: number
  height: number
}

// "Background" = any pixel that matches the top-left pixel (within `tol` per channel).
export function cropAndWhiten(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, tol = 3, padRatio = 0.12): Cropped | null {
  const bg = [rgba[0], rgba[1], rgba[2]]
  const isBg = (i: number) =>
    Math.abs(rgba[i] - bg[0]) <= tol && Math.abs(rgba[i + 1] - bg[1]) <= tol && Math.abs(rgba[i + 2] - bg[2]) <= tol
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (!isBg((y * w + x) * 4)) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) return null // nothing but background: leave the picture as it is
  const pad = Math.max(8, Math.round(Math.max(x1 - x0 + 1, y1 - y0 + 1) * padRatio))
  const cx0 = Math.max(0, x0 - pad), cy0 = Math.max(0, y0 - pad)
  const cx1 = Math.min(w - 1, x1 + pad), cy1 = Math.min(h - 1, y1 + pad)
  const width = cx1 - cx0 + 1, height = cy1 - cy0 + 1
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const src = ((cy0 + y) * w + (cx0 + x)) * 4
      const dst = (y * width + x) * 4
      const white = isBg(src)
      data[dst] = white ? 255 : rgba[src]
      data[dst + 1] = white ? 255 : rgba[src + 1]
      data[dst + 2] = white ? 255 : rgba[src + 2]
      data[dst + 3] = 255
    }
  return { data, width, height }
}

const cache = new Map<string, Promise<string>>()

// Browser only: returns a trimmed PNG data URL, or the original if anything goes wrong.
export function trimStructure(dataUrl: string): Promise<string> {
  let p = cache.get(dataUrl)
  if (!p) {
    p = (async () => {
      try {
        const img = new Image()
        img.src = dataUrl
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        const id = ctx.getImageData(0, 0, c.width, c.height)
        const r = cropAndWhiten(id.data, id.width, id.height)
        if (!r) return dataUrl
        const o = document.createElement('canvas')
        o.width = r.width
        o.height = r.height
        o.getContext('2d')!.putImageData(new ImageData(r.data as Uint8ClampedArray<ArrayBuffer>, r.width, r.height), 0, 0)
        return o.toDataURL('image/png')
      } catch {
        return dataUrl
      }
    })()
    cache.set(dataUrl, p)
  }
  return p
}
