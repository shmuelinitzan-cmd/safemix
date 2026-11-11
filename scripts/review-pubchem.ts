// Fetches the demo chemicals live and prints every card value with its source, so a
// human can check it BEFORE anything is saved into the app.
// Usage: node scripts/review-pubchem.ts <out-dir>
import { writeFileSync, mkdirSync } from 'node:fs'
import { lookup } from '../src/lib/pubchem.ts'
import { fetchNpgIndex, lookupNiosh } from '../src/lib/niosh.ts'
import { convertPressure, convertTemperature } from '../src/lib/units.ts'
import { FIELD_KEYS, FIELD_LABELS } from '../src/types/card.ts'

const out = process.argv[2]
if (!out) throw new Error('Give an output folder')
mkdirSync(out, { recursive: true })
const date = new Date().toISOString().slice(0, 10)
const names = ['acetone', 'ethanol', 'glacial acetic acid', 'sodium hydroxide', 'hydrogen peroxide']
const npgIndex = await fetchNpgIndex()
let md = `# Card values for review (retrieved ${date})\n\nValues are shown exactly as the source gave them. "converted" is arithmetic shown for convenience only and is NOT stored.\n`
const all: Record<string, unknown> = {}
for (const n of names) {
  const r = await lookup(n, date)
  const nio = r.cas ? await lookupNiosh(r.cas.value, npgIndex) : undefined
  all[n] = { pubchem: r, niosh: nio }
  md += `\n## ${n}  (PubChem CID ${r.cid}, title "${r.title}", CAS ${r.cas?.value ?? 'not found'})\n`
  for (const k of FIELD_KEYS) {
    const f = r.fields[k]
    if (!f) { md += `- **${FIELD_LABELS[k]}**: _No data from approved sources_\n`; continue }
    const conv = k === 'bp' || k === 'mp' ? convertTemperature(f.value) : k === 'vapor_pressure' ? convertPressure(f.value) : undefined
    md += `- **${FIELD_LABELS[k]}**: ${f.value.replace(/\n/g, ' / ')}${f.unit ? ' ' + f.unit : ''}${f.quantity === 'relative_density' ? '  [shown as: relative density, no unit]' : ''}`
    if (conv) md += `  → converted: ${conv}`
    if (f.condition) md += `  [condition: "${f.condition}"]`
    md += `\n  - source: ${f.source === 'app' ? 'rule in app code (' + r.waste_reason + '), needs confirmation' : (f.upstream ?? '?') + (f.upstream_citation ? ' — ' + f.upstream_citation.slice(0, 140) : '')}\n  - url: ${f.source_url}\n`
  }
  md += nio
    ? `- _NIOSH cross-check only (not on the card; not split by route)_ — ${nio.page_url}, last reviewed ${nio.last_reviewed}\n  - routes: ${nio.exposure_routes?.replace(/\n/g, ' / ')}\n  - symptoms: ${nio.symptoms?.replace(/\n/g, ' / ')}\n`
    : `- NIOSH: no page found for this CAS\n`
}
writeFileSync(`${out}/review.md`, md)
writeFileSync(`${out}/review.json`, JSON.stringify(all, null, 1))
console.log('done')
