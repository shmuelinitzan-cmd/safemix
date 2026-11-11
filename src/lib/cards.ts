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

// A person edits a value. It becomes origin "user"; what the source said is kept.
export function editField(card: ChemicalCard, key: FieldKey, value: string, note?: string): ChemicalCard {
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
      quantity: undefined,
      condition: undefined,
      source: 'user',
      origin: 'user',
      status: 'pending',
      retrieved_at: today(),
      note: note ?? 'Edited by hand.',
      source_value: old && old.origin !== 'user' ? old.value : old?.source_value,
      upstream: undefined, // the old source no longer backs this value
      upstream_citation: undefined,
    }
  }
  return { ...card, fields, updated_at: today() }
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

export type CorrectionTable = Record<string, Partial<Record<FieldKey, { value: string; note: string }>>>

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
