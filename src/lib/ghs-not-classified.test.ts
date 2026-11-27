// A GHS entry that says "Not Classified" is not a hazard statement. Fake records (title "T",
// CID 1, made-up counts); only the form of the two lines follows PubChem's wording.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parseRecord } from './pubchem.ts'
import { cardFromLookup } from './cards.ts'
import { cellsFor, ghsInsteadOfNfpa, sourceRows, toCsv } from './table.ts'
import CardScreen from '../screens/CardScreen.tsx'

const ECHA = 'European Chemicals Agency (ECHA)'
const LINES = ['Not Classified', 'Reported as not meeting GHS hazard criteria by 1 of 2 companies. Fake detail.']
const parse = (lines: string[], source = ECHA) => parseRecord({
  RecordNumber: 1, RecordTitle: 'T', Reference: [{ ReferenceNumber: 1, SourceName: source }],
  Section: [{ TOCHeading: 'GHS Classification', Information: [
    { Name: 'GHS Hazard Statements', ReferenceNumber: 1, Value: { StringWithMarkup: lines.map((String) => ({ String })) } }] }],
}, '2026-01-01')

describe('an entry that only says "Not Classified"', () => {
  const r = parse(LINES)
  const card = cardFromLookup(r)
  const ghs = r.fields.ghs

  it('is shown as "Not classified (no GHS hazard)"', () => expect(ghs?.value).toBe('Not classified (no GHS hazard)'))
  it('keeps its source and link', () => {
    expect(ghs).toMatchObject({ source: 'pubchem', upstream: ECHA, status: 'pending' })
    expect(ghs?.source_url).toContain('#section=GHS-Classification')
  })
  it("the note names the source and quotes PubChem's text; it does not call it a hazard statement", () => {
    expect(ghs?.note).toBe(`No hazard statement in the ${ECHA} entry. PubChem's text: "${LINES.join(' / ')}"`)
  })
  it('adds nothing to the exposure columns', () => {
    for (const k of ['exp_eyes', 'exp_skin', 'exp_inhalation', 'exp_ingestion'] as const) expect(r.fields[k]).toBeUndefined()
  })
  it('table and CSV name the source in the cell', () => {
    expect(ghsInsteadOfNfpa(card)).toBe('GHS Not classified (no GHS hazard), source: ECHA')
    expect(toCsv([card])).toContain('GHS Not classified (no GHS hazard), source: ECHA')
    expect(Object.values(cellsFor(card)).join(' ')).not.toContain('Reported as not meeting')
  })
  it('sources list and card screen show the source', () => {
    const row = sourceRows([card]).find((x) => x.field === 'GHS hazards')!
    expect(row.source).toContain(ECHA)
    expect(row.detail).toContain('Reported as not meeting')
    const noop = async () => {}
    const html = renderToStaticMarkup(createElement(CardScreen, { card, saved: false, onSave: noop, onDelete: noop, onBack: () => {} }))
    expect(html).toContain('Not classified (no GHS hazard)')
    expect(html).not.toContain('GHS hazard statements reported by')
  })
  it('names another source when the entry is not from ECHA', () => {
    const other = parse(['Not Classified'], 'Fake Source (FS)')
    expect(other.fields.ghs?.note).toContain('in the Fake Source (FS) entry')
    expect(ghsInsteadOfNfpa(cardFromLookup(other))).toBe('GHS Not classified (no GHS hazard), source: FS')
  })
  it('the "Reported as not meeting" line alone counts too', () => {
    expect(parse([LINES[1]]).fields.ghs?.value).toBe('Not classified (no GHS hazard)')
  })
})

describe('"no GHS hazard" is never claimed when the entry has a hazard code', () => {
  it('hazards under half: no GHS value at all, as before', () => {
    expect(parse(['H319 (10%): fake [Warning Fake]', ...LINES]).fields.ghs).toBeUndefined()
  })
  it('a listed hazard: only the hazard is shown; the other lines are quoted in the note', () => {
    const f = parse(['H319 (90%): fake [Warning Fake]', ...LINES]).fields
    expect(f.ghs?.value).toBe('Warning: H319: fake')
    expect(f.ghs?.note).toContain('Not a hazard statement, also in this entry: "Not Classified / Reported as not meeting')
  })
  it('an unreadable hazard line stays', () => {
    expect(parse(['H319 (< 99%): fake', ...LINES]).fields.ghs?.value).toBe('H319 (< 99%): fake')
  })
  it('other unreadable text is still shown as written', () => {
    expect(parse(['Fake unreadable line', ...LINES]).fields.ghs?.value).toBe('Fake unreadable line')
  })
  it('a line that mentions a hazard code is not taken for "not classified"', () => {
    const line = 'Reported as not meeting GHS hazard criteria for H319'
    expect(parse([line]).fields.ghs?.value).toBe(line)
  })
})
