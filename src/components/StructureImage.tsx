import { useEffect, useState } from 'react'
import type { Structure } from '../types/card.ts'
import { trimStructure } from '../lib/crop.ts'

// Shows the stored PubChem picture with its empty margin trimmed (display only).
// It stays hidden for a moment while trimming, then appears; if trimming fails the
// original picture is shown.
export default function StructureImage({ structure, name }: { structure: Structure; name: string }) {
  const [shown, setShown] = useState<{ from: string; src: string } | null>(null)
  useEffect(() => {
    let alive = true
    trimStructure(structure.data_url).then((src) => alive && setShown({ from: structure.data_url, src }))
    return () => { alive = false }
  }, [structure.data_url])
  const ready = shown?.from === structure.data_url
  return (
    <img src={ready ? shown.src : structure.data_url} alt={`2D structure of ${name}`}
      className={`h-auto max-h-64 w-auto min-w-40 max-w-80 rounded border border-slate-200 bg-white ${ready ? '' : 'invisible'}`} />
  )
}
