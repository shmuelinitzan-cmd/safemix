// Builds src/data/demo-cards.json from the review snapshot Nitzan checked by hand.
// Usage: node scripts/build-demo.ts <path-to-review.json>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { approveCard, applyCorrections, cardFromLookup } from '../src/lib/cards.ts'
import { MANUAL_CORRECTIONS } from '../src/data/manual-corrections.ts'
import type { ChemicalCard } from '../src/types/card.ts'

const src = process.argv[2]
if (!src) throw new Error('Give the path to review.json')
const snapshot = JSON.parse(readFileSync(src, 'utf8'))
const today = new Date().toISOString().slice(0, 10)

const cards: ChemicalCard[] = Object.values(snapshot).map((entry) => {
  const r = (entry as { pubchem: Parameters<typeof cardFromLookup>[0] }).pubchem
  const draft = cardFromLookup(r)
  // Dates stay those of the reviewed retrieval.
  const reviewed = r.fields.name!.retrieved_at
  draft.created_at = draft.updated_at = reviewed
  const corrected = applyCorrections(draft, MANUAL_CORRECTIONS, today)
  const approved = approveCard(corrected)
  // The waste container is only a rule-based suggestion: it stays pending until the lab confirms it.
  if (approved.fields.waste_container) approved.fields.waste_container.status = 'pending'
  return approved
})

mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/demo-cards.json', JSON.stringify(cards, null, 1) + '\n')
mkdirSync('review', { recursive: true })
writeFileSync('review/demo-snapshot.json', readFileSync(src, 'utf8'))
console.log(cards.map((c) => `${c.fields.name?.value} (${c.cas?.value})`).join('\n'))
