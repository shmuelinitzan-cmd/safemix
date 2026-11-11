// 2D structure picture from PubChem's PUG REST PNG endpoint, by CID. No other image source.
import type { ChemicalCard, Structure } from '../types/card.ts'
import { parseFormula } from './waste.ts'

// Organic = the formula contains carbon (same test as the waste rule).
export const isOrganic = (card: ChemicalCard) => {
  const formula = card.fields.formula?.value
  return !!formula && !!parseFormula(formula).C
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47]

export async function fetchStructure(cid: number, date = new Date().toISOString().slice(0, 10)): Promise<Structure | undefined> {
  // Asked for large (1000x1000): PubChem then draws the molecule bigger, so it stays sharp
  // when the empty margin is trimmed for display. Same PNG endpoint, same source.
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=1000x1000`
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return undefined // not a PNG: do not store
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return { data_url: `data:image/png;base64,${btoa(binary)}`, source: 'pubchem', source_url: url, retrieved_at: date, status: 'pending' }
  } catch {
    return undefined // no picture is fine; the card still works
  }
}

// Adds the picture to an organic card. Inorganic cards and failed downloads are left as they are.
export async function attachStructure(card: ChemicalCard): Promise<ChemicalCard> {
  if (!isOrganic(card) || !card.pubchem_cid || card.structure) return card
  const structure = await fetchStructure(card.pubchem_cid)
  return structure ? { ...card, structure } : card
}
