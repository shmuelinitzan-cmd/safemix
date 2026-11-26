// One place that decides how a value's source is labelled. The card, library, experiment
// table, PDF and CSV all use it.
import type { ChemicalCard, FieldKey } from '../types/card.ts'
import { MANUAL_CORRECTIONS } from '../data/manual-corrections.ts'

export const NOT_VERIFIED = 'Not verified'

// The reference book behind a documented correction. It applies only to the exact value listed
// in manual-corrections.ts (same chemical, field, value and note). Typing a handbook's name
// next to any other value does not count.
export function documentedReference(card: ChemicalCard, key: FieldKey): string | undefined {
  const f = card.fields[key]
  const fix = MANUAL_CORRECTIONS[card.cas?.value ?? '']?.[key]
  return f && fix?.reference && f.source === 'user' && f.value === fix.value && f.note === fix.note ? fix.reference : undefined
}

// Typed in by hand (with no documented reference), or marked as SDS without naming the SDS.
export function isNotVerified(card: ChemicalCard, key: FieldKey): boolean {
  const f = card.fields[key]
  if (!f) return false
  if (f.source === 'sds') return !f.upstream?.trim()
  return f.source === 'user' && !documentedReference(card, key)
}
