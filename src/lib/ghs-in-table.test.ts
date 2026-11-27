// No GHS hazard may drop out of the printed table: every H-code in a card's GHS summary must
// be in the on-screen table, the CSV and the PDF's MAIN table, whether or not the card has
// NFPA ratings. Fake records (title "T", CID 1) and the saved real PubChem records.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parseRecord } from './pubchem.ts'
import { cardFromLookup } from './cards.ts'
import { FOOTNOTES, toCsv } from './table.ts'
import { buildExperimentPdf } from './pdf.ts'
import ExperimentTable from '../components/ExperimentTable.tsx'
import type { ChemicalCard } from '../types/card.ts'

const swm = (...lines: string[]) => ({ Value: { StringWithMarkup: lines.map((String) => ({ String })) } })
const fake = (nfpa: Record<string, string>, ghs: string[]): ChemicalCard => cardFromLookup(parseRecord({
  RecordNumber: 1, RecordTitle: 'T', Reference: [],
  Section: [
    { TOCHeading: 'NFPA Hazard Classification', Information: Object.entries(nfpa).map(([Name, v]) => ({ Name, ...swm(v) })) },
    { TOCHeading: 'GHS Classification', Information: ghs.length ? [{ Name: 'GHS Hazard Statements', ...swm(...ghs) }] : [] },
  ],
}, '2026-01-01'))
const RATED = { 'NFPA Fire Rating': '1', 'NFPA Health Rating': '2', 'NFPA Instability Rating': '0' }
// Codes for cancer, genetic defects and aquatic life belong to no exposure column.
const NO_ROUTE = ['H351', 'H341', 'H410']
const LINES = NO_ROUTE.map((c) => `${c} (100%): fake ${c} [Warning Fake]`)

// The three printed forms of the table. The PDF is cut where the sources pages begin.
const screen = (c: ChemicalCard) => renderToStaticMarkup(createElement(ExperimentTable, { cards: [c] })).split('</table>')[0]
const csv = (c: ChemicalCard) => toCsv([c]).split('\r\n')[1]
async function pdfMainTable(c: ChemicalCard) {
  const text = new TextDecoder('latin1').decode(await buildExperimentPdf('T', [c], '2026-01-01'))
  const end = text.indexOf('Every value in the table, as stored')
  expect(end).toBeGreaterThan(0)
  return text.slice(0, end)
}
const codes = (c: ChemicalCard) => [...new Set(c.fields.ghs?.value.match(/H\d{3}[A-Za-z]*(?=[:+])/g) ?? [])]

describe.each<[string, Record<string, string>]>([
  ['all three ratings', RATED],
  ['only one rating', { 'NFPA Health Rating': '2' }],
  ['only a special notice', { 'NFPA Specific Notice': 'XX - fake' }],
])('a card with NFPA data (%s)', (_label, nfpa) => {
  const card = fake(nfpa, LINES)
  it('screen: the NFPA cells and every GHS code', () => {
    for (const code of NO_ROUTE) expect(screen(card)).toContain(`${code}: fake`)
    expect(screen(card)).toContain('rowSpan="2"')
  })
  it('CSV: every GHS code', () => {
    for (const code of NO_ROUTE) expect(csv(card)).toContain(code)
  })
  it('PDF main table: every GHS code', async () => {
    const table = await pdfMainTable(card)
    for (const code of NO_ROUTE) expect(table).toContain(code)
  })
})

describe('other GHS summaries beside NFPA ratings', () => {
  it('an unreadable line without a code stays in all three', async () => {
    const card = fake(RATED, ['Fake unreadable line'])
    for (const out of [screen(card), csv(card), await pdfMainTable(card)]) expect(out).toContain('Fake unreadable line')
  })
  it('"Not classified" is shown with its source', () => {
    const card = fake(RATED, ['Not Classified'])
    for (const out of [screen(card), csv(card)]) expect(out).toContain('Not classified (no GHS hazard)')
  })
  it('a card without a GHS summary keeps one line', () => {
    const card = fake(RATED, [])
    expect(screen(card)).not.toContain('rowSpan="2">1')
    expect(screen(card).match(/<tr/g)).toHaveLength(3)
    expect(csv(card).endsWith(',')).toBe(true) // empty GHS column
  })
  it('the legend says the GHS statements appear with the NFPA columns too', () => {
    expect(FOOTNOTES.find((n) => n.startsWith('GHS ='))).toContain('under the NFPA ratings')
  })
})

const saved = import.meta.glob<{ Record: unknown }>('./__fixtures__/*.json', { import: 'default', eager: true })
describe.each(Object.entries(saved))('real record %s', (_path, json) => {
  const card = cardFromLookup(parseRecord(json.Record, '2026-01-01'))
  it('every GHS code on the card is in the screen table, CSV and PDF main table', async () => {
    expect(codes(card).length).toBeGreaterThan(0)
    const outputs = { screen: screen(card), csv: csv(card), pdf: await pdfMainTable(card) }
    for (const [where, out] of Object.entries(outputs)) {
      // look for the code inside the GHS cell: from "GHS Danger" or "GHS Warning" onwards
      const cell = out.slice(out.search(/GHS (Danger|Warning)/))
      expect(out, where).toMatch(/GHS (Danger|Warning)/)
      for (const code of codes(card)) expect(cell, `${where} ${code}`).toContain(code)
    }
  })
})
