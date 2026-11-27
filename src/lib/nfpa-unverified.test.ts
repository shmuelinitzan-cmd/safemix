// An NFPA entry that is not a single rating must show as written and "Not verified" everywhere.
// Fake record (title "T", CID 1).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parseRecord } from './pubchem.ts'
import { approveCard, cardFromLookup, editField } from './cards.ts'
import { cellsFor, sourceRows, toCsv } from './table.ts'
import { buildExperimentPdf, pdfCell } from './pdf.ts'
import { exportLibrary, parseLibraryFile } from './library-io.ts'
import { isNotVerified } from './provenance.ts'
import ExperimentTable from '../components/ExperimentTable.tsx'
import NfpaDiamond from '../components/NfpaDiamond.tsx'
import CardScreen from '../screens/CardScreen.tsx'

const cardWith = (raw: string) => cardFromLookup(parseRecord({
  RecordNumber: 1, RecordTitle: 'T', Reference: [],
  Section: [{ TOCHeading: 'NFPA Hazard Classification', Information: [
    { Name: 'NFPA Fire Rating', Value: { StringWithMarkup: [{ String: raw }] } }] }],
}, '2026-01-01'))
const card = approveCard(cardWith('1-2'))
const diamond = (c: typeof card) => renderToStaticMarkup(createElement(NfpaDiamond, { card: c }))

describe('an unread NFPA entry', () => {
  it('stays "Not verified" after approval', () => expect(isNotVerified(card, 'nfpa_fire')).toBe(true))
  it('table, CSV and PDF cell', () => {
    expect(cellsFor(card).fire).toBe('1-2 (Not verified)')
    expect(toCsv([card])).toContain('1-2 (Not verified)')
    expect(pdfCell('fire', cellsFor(card).fire)).toBe('1-2*')
  })
  it('sources list says it is not verified and why', () => {
    const row = sourceRows([card]).find((r) => r.field === 'NFPA 704 Fire')!
    expect(row.value).toBe('1-2')
    expect(row.source).toContain('Not verified: PubChem')
    expect(row.detail).toContain('Shown as PubChem wrote it.')
  })
  it('card screen', () => {
    const noop = async () => {}
    const html = renderToStaticMarkup(createElement(CardScreen, { card, saved: true, onSave: noop, onDelete: noop, onBack: () => {} }))
    expect(html).toContain('Not verified')
    expect(html).toContain('Shown as PubChem wrote it.')
  })
  it('diamond: short text is shown with "*"', () => expect(diamond(card)).toContain('>1-2*</text>'))
  it('diamond: long text becomes "?*", never a number; the label has the full text', () => {
    const html = diamond(cardWith('2 - or 3'))
    expect(html).toContain('>?*</text>')
    expect(html).toContain('fire 2 - or 3*')
  })
  it('the mark survives export and import', () => {
    const back = parseLibraryFile(exportLibrary([card], [])).cards[0]
    expect(back.fields.nfpa_fire?.unverified).toBe(true)
    expect(cellsFor(back).fire).toBe('1-2 (Not verified)')
  })
  it('a value typed in from a named SDS replaces the mark', () => {
    const edited = editField(card, 'nfpa_fire', '2', undefined, { citation: 'Fake SDS' })
    expect(edited.fields.nfpa_fire?.unverified).toBeUndefined()
    expect(cellsFor(edited).fire).toBe('2 (SDS)')
  })
})

describe('GHS stays in the table when an NFPA rating could not be read', () => {
  const both = (fire: string) => cardFromLookup(parseRecord({
    RecordNumber: 1, RecordTitle: 'T', Reference: [],
    Section: [
      { TOCHeading: 'NFPA Hazard Classification', Information: [{ Name: 'NFPA Fire Rating', Value: { StringWithMarkup: [{ String: fire }] } }] },
      { TOCHeading: 'GHS Classification', Information: [{ Name: 'GHS Hazard Statements', Value: { StringWithMarkup: [{ String: 'H225 (100%): fake summary-only hazard [Danger Fake]' }] } }] },
    ],
  }, '2026-01-01'))
  const unread = both('1-2')
  const read = both('2')
  const table = (c: typeof unread) => renderToStaticMarkup(createElement(ExperimentTable, { cards: [c] }))
  const pdf = async (c: typeof unread) => new TextDecoder('latin1').decode(await buildExperimentPdf('T', [c], '2026-01-01'))

  it('screen: the NFPA text, and the GHS cell on a second line', () => {
    const html = table(unread)
    expect(html).toContain('1-2 (Not verified)')
    expect(html).toContain('GHS Danger: H225')
    expect(html.match(/<tr/g)).toHaveLength(4) // 2 header rows + 2 lines for the chemical
    expect(html).toContain('rowSpan="2"')
  })
  it('CSV: both', () => {
    const row = toCsv([unread]).split('\r\n')[1]
    expect(row).toContain('1-2 (Not verified)')
    expect(row).toContain('GHS Danger: H225')
  })
  it('PDF: both, with the GHS cell in the table and not only in the sources list', async () => {
    const text = await pdf(unread)
    const main = text.slice(0, text.indexOf('Every value in the table, as stored'))
    expect(main).toContain('1-2*')
    expect(main).toContain('H225')
  })
  it('a readable rating shows the GHS line too', () => {
    expect(table(read)).toContain('GHS Danger: H225')
    expect(toCsv([read]).split('\r\n')[1]).toContain('GHS Danger: H225')
  })
})
