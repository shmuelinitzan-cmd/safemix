// Pure helpers on cards (no browser APIs), so they can be tested.
import type { ChemicalCard, Field, FieldKey } from '../types/card.ts'
import { FIELD_KEYS } from '../types/card.ts'
import type { PubChemResult } from './pubchem.ts'

export const today = () => new Date().toISOString().slice(0, 10)

// A card drafted from a live PubChem lookup. Nothing is approved yet.
export function cardFromLookup(r: PubChemResult): ChemicalCard {
  const now = today()
  return {
    id: r.cas ? `cas-${r.cas.value}` : `cid-${r.cid}`,
    cas: r.cas,
    pubchem_cid: r.cid,
    created_at: now,
    updated_at: now,
    fields: { ...r.fields },
  }
}

// Where a hand-entered value comes from. Without one it is shown as "Not verified".
export interface SdsCitation {
  citation: string // e.g. "Sigma-Aldrich SDS 438073, rev. 2024-03-12"
  url?: string // https link to that SDS, when there is one
}

// A person edits a value. It becomes origin "user"; what the source said is kept.
// With an SDS citation the value is recorded as coming from the supplier SDS.
export function editField(card: ChemicalCard, key: FieldKey, value: string, note?: string, sds?: SdsCitation): ChemicalCard {
  const old = card.fields[key]
  const trimmed = value.trim()
  const fields = { ...card.fields }
  if (!trimmed) {
    delete fields[key] // emptying a field means "no data"
  } else if (!old || old.value !== trimmed) {
    fields[key] = {
      ...(old ?? { source_url: '', retrieved_at: today() }),
      value: trimmed,
      unit: undefined,
      unverified: undefined, // a new value replaces the entry that could not be read
      quantity: undefined,
      condition: undefined,
      source: sds ? 'sds' : 'user',
      origin: 'user',
      status: 'pending',
      retrieved_at: today(),
      source_url: sds?.url && /^https:\/\/\S+$/.test(sds.url.trim()) ? sds.url.trim() : '',
      note: note ?? (sds ? 'Typed in from the supplier SDS.' : 'Edited by hand.'),
      source_value: old && old.origin !== 'user' ? old.value : old?.source_value,
      upstream: sds ? sds.citation.trim() : undefined, // the old source no longer backs this value
      upstream_citation: undefined,
    }
  }
  return { ...card, fields, updated_at: today() }
}

// A solution card made from a pure-compound card ("Nitric Acid" -> "Nitric Acid, 5%").
// Only the identity of the solute is carried over (formula, MW) plus the waste-container
// suggestion, which depends on the solute. BP, MP, density, vapour pressure, NFPA and
// exposure hazards of the PURE compound do not apply to the solution, so they are left
// empty, to be typed in from the supplier SDS of the solution.
const CARRY_TO_SOLUTION: FieldKey[] = ['formula', 'mw', 'waste_container']
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function makeSolutionCard(pure: ChemicalCard, concentration: string): ChemicalCard {
  const conc = concentration.trim()
  if (!conc) throw new Error('Concentration is empty.')
  const now = today()
  const pureName = pure.fields.name?.value ?? 'Unnamed chemical'
  const fields: ChemicalCard['fields'] = {}
  for (const k of CARRY_TO_SOLUTION) if (pure.fields[k]) fields[k] = { ...pure.fields[k]!, status: 'pending' }
  if (fields.mw) fields.mw = { ...fields.mw, note: 'MW of the dissolved compound.' }
  fields.name = {
    value: `${pureName}, ${conc}`, source: 'user', origin: 'user', status: 'pending', retrieved_at: now,
    source_url: '', note: `Solution card made from "${pureName}".`,
  }
  return {
    id: `${pure.id}-sol-${slugify(conc) || 'solution'}`,
    cas: pure.cas, pubchem_cid: pure.pubchem_cid, structure: pure.structure && { ...pure.structure, status: 'pending' },
    concentration: conc, parent_id: pure.id, created_at: now, updated_at: now, fields,
  }
}

// "Approve and save": the person accepts every value that is on the card.
export function approveCard(card: ChemicalCard): ChemicalCard {
  const fields: ChemicalCard['fields'] = {}
  for (const k of FIELD_KEYS) {
    const f = card.fields[k]
    if (f) fields[k] = { ...f, status: 'approved' }
  }
  const structure = card.structure && { ...card.structure, status: 'approved' as const }
  return { ...card, fields, structure, updated_at: today() }
}

export const isFullyApproved = (card: ChemicalCard) =>
  FIELD_KEYS.every((k) => !card.fields[k] || card.fields[k]!.status === 'approved') &&
  (!card.structure || card.structure.status === 'approved')

export function matches(card: ChemicalCard, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [card.fields.name?.value, card.fields.formula?.value, card.cas?.value]
    .some((v) => v?.toLowerCase().includes(q))
}

// NFPA 704 diamond: colours are fixed by the standard (blue health, red fire, yellow reactivity).
export const NFPA_COLORS = { health: '#2563eb', fire: '#dc2626', reactivity: '#facc15', special: '#ffffff' } as const

// `reference` names the book a correction was checked against, when that is documented.
export type CorrectionTable = Record<string, Partial<Record<FieldKey, { value: string; note: string; reference?: string }>>>

// Manual corrections by CAS, each made by Nitzan after checking a handbook.
export function applyCorrections(card: ChemicalCard, table: CorrectionTable, date: string): ChemicalCard {
  const cas = card.cas?.value
  const fixes = cas ? table[cas] : undefined
  if (!fixes) return card
  const fields = { ...card.fields }
  for (const [key, fix] of Object.entries(fixes) as [FieldKey, { value: string; note: string }][]) {
    const old = fields[key] as Field | undefined
    fields[key] = {
      value: fix.value, source: 'user', origin: 'user', status: 'pending', retrieved_at: date,
      source_url: old?.source_url ?? '', note: fix.note, source_value: old?.value,
    }
  }
  return { ...card, fields }
}
