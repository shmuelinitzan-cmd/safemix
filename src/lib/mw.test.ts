// Stage 2, part A: molecular weight (MW) and formula parsing.
// SafeMix does NOT calculate MW: it copies PubChem's value. Records here are fake
// (title "T", CID 1, placeholder numbers). Formula strings are only parser input.
//
// `it.fails` = the correct behaviour the app does not have yet (see units.test.ts).
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import demo from '../data/demo-cards.json'
import snapshot from '../../review/demo-snapshot.json'
import type { ChemicalCard } from '../types/card.ts'
import { parseRecord } from './pubchem.ts'
import { cardFromLookup, editField, makeSolutionCard } from './cards.ts'
import { cellsFor, sourceRows, toCsv } from './table.ts'
import { exportLibrary, parseLibraryFile } from './library-io.ts'
import { isNotVerified } from './provenance.ts'
import { parseFormula } from './waste.ts'
import { isOrganic } from './structure.ts'
import CardScreen from '../screens/CardScreen.tsx'

const text = (...lines: string[]) => ({ ReferenceNumber: 1, Value: { StringWithMarkup: lines.map((String) => ({ String })) } })
const record = (mwEntries?: object[]) => ({
  RecordNumber: 1, RecordTitle: 'T',
  Reference: [{ ReferenceNumber: 1, SourceName: 'Fake Source (FS)' }],
  Section: [
    { TOCHeading: 'Molecular Formula', Information: [text('C2H4')] },
    ...(mwEntries ? [{ TOCHeading: 'Molecular Weight', Information: mwEntries }] : []),
  ],
})
const parse = (...mwEntries: object[]) => parseRecord(record(mwEntries), '2026-01-01')
const mwOf = (entry: object) => parse(entry).fields.mw

describe('A1-A3: the value and unit are copied', () => {
  it.each(['100.500', '100.50', '100', '0.001', '1234.5678'])('text "%s" is copied exactly', (v) => {
    expect(mwOf(text(v))?.value).toBe(v)
  })
  it('a numeric value is read and written as JavaScript writes the number', () => {
    expect(mwOf({ ReferenceNumber: 1, Value: { Number: [100.5] } })?.value).toBe('100.5')
  })
  it('the unit comes from the record', () => {
    expect(mwOf({ ReferenceNumber: 1, Value: { Number: [100], Unit: 'fake-unit' } })?.unit).toBe('fake-unit')
  })
  it('g/mol is used only when the record gives no unit', () => expect(mwOf(text('100'))?.unit).toBe('g/mol'))
})

describe('A4: a missing MW stays missing, and nothing is derived from the formula', () => {
  it.each([
    ['no MW section', undefined],
    ['an empty entry list', []],
    ['an entry with no value', [{ ReferenceNumber: 1, Value: {} }]],
    ['an empty string', [text('')]],
    ['an empty number list', [{ ReferenceNumber: 1, Value: { Number: [] } }]],
  ])('%s', (_label, entries) => {
    const r = parseRecord(record(entries), '2026-01-01')
    expect(r.fields.formula?.value).toBe('C2H4')
    expect(r.fields.mw).toBeUndefined()
    expect(r.missing).toContain('mw')
  })
  // BUG: a MW made only of spaces is accepted as a value.
  it.fails('BUG: text that is only spaces', () => expect(mwOf(text('   '))).toBeUndefined())
})

describe('A5-A6: where the value came from', () => {
  it('keeps source, link, upstream name, citation, date and pending status', () => {
    expect(mwOf({ ...text('100'), Reference: ['Fake citation'] })).toMatchObject({
      source: 'pubchem', origin: 'source', status: 'pending', retrieved_at: '2026-01-01',
      source_url: 'https://pubchem.ncbi.nlm.nih.gov/compound/1#section=Molecular-Weight',
      upstream: 'Fake Source (FS)', upstream_citation: 'Fake citation',
    })
  })
  it('current behaviour: with several entries, the first is used', () => {
    expect(parse(text('100'), text('200')).fields.mw?.value).toBe('100')
  })
})

describe('A7: every output shows the same MW', () => {
  const card = cardFromLookup(parse(text('100.500')))
  it('table, CSV and sources list', () => {
    expect(cellsFor(card).mw).toBe('100.500')
    expect(toCsv([card]).split('\r\n')[1].split(',')).toContain('100.500')
    expect(sourceRows([card]).find((r) => r.field === 'MW (g/mol)')?.value).toBe('100.500')
  })
  it('card screen, with its unit', () => {
    const noop = async () => {}
    const html = renderToStaticMarkup(createElement(CardScreen, { card, saved: false, onSave: noop, onDelete: noop, onBack: () => {} }))
    expect(html).toContain('100.500')
    expect(html).toContain(' g/mol')
  })
  it('after export and import', () => {
    expect(parseLibraryFile(exportLibrary([card], [])).cards[0].fields.mw).toEqual(card.fields.mw)
  })
  // The table column is headed "MW (g/mol)", so another unit must not disappear there.
  // BUG: the table, CSV and PDF cells drop the MW unit.
  it.fails('BUG: a unit other than g/mol stays visible in the table', () => {
    const other = cardFromLookup(parse({ ReferenceNumber: 1, Value: { Number: [100], Unit: 'fake-unit' } }))
    expect(cellsFor(other).mw).toContain('fake-unit')
  })
})

describe('A8-A9: solution cards and hand edits', () => {
  const card = cardFromLookup(parse(text('100.500')))
  it("a solution card keeps the solute's MW, with a note", () => {
    expect(makeSolutionCard(card, '1% fake').fields.mw).toMatchObject({ value: '100.500', note: 'MW of the dissolved compound.', source: 'pubchem' })
  })
  it('a hand-edited MW is "Not verified" and keeps the PubChem value', () => {
    const edited = editField(card, 'mw', '101')
    expect(isNotVerified(edited, 'mw')).toBe(true)
    expect(edited.fields.mw).toMatchObject({ value: '101', source: 'user', source_value: '100.500', source_url: '' })
    expect(cellsFor(edited).mw).toBe('101 (Not verified)')
    expect(sourceRows([edited]).find((r) => r.field === 'MW (g/mol)')?.detail).toContain('Previous value: 100.500')
  })
})

describe('A10: demo cards carry the reviewed MW', () => {
  const cards = demo as unknown as ChemicalCard[]
  const reviewed = Object.values(snapshot).map((e) => e.pubchem)
  it('there are 5 of each', () => {
    expect(cards).toHaveLength(5)
    expect(reviewed).toHaveLength(5)
  })
  it.each(reviewed.map((r) => [r.title, r] as const))('%s', (_title, r) => {
    const mw = cards.find((c) => c.cas?.value === r.cas.value)?.fields.mw
    const { value, unit, source, source_url, upstream, retrieved_at } = r.fields.mw
    expect(mw).toMatchObject({ value, unit, source, source_url, upstream, retrieved_at })
  })
})

describe('A11: formula parsing counts atoms', () => {
  it.each<[string, Record<string, number>]>([
    ['C12H22O11', { C: 12, H: 22, O: 11 }],
    ['CH3CH2OH', { C: 2, H: 6, O: 1 }],
    ['CO', { C: 1, O: 1 }],
    ['Co', { Co: 1 }],
    ['CoCl2', { Co: 1, Cl: 2 }],
    ['Cl2', { Cl: 2 }],
    ['CaCl2', { Ca: 1, Cl: 2 }],
    ['', {}],
  ])('"%s"', (formula, counts) => expect(parseFormula(formula)).toEqual(counts))

  it('"Co" and "Cl" do not make a formula organic; "C" does', () => {
    const withFormula = (value: string) => editField(cardFromLookup(parse(text('100'))), 'formula', value)
    expect(isOrganic(withFormula('CoCl2'))).toBe(false)
    expect(isOrganic(withFormula('CO'))).toBe(true)
  })
})

describe('A12: formulas with groups, hydrate dots and charges', () => {
  it.each<[string, Record<string, number>]>([
    ['NH4+', { N: 1, H: 4 }],
    ['SO4-2', { S: 1, O: 4 }],
    ['C2H3O2-', { C: 2, H: 3, O: 2 }],
  ])('a charge does not change the counts: "%s"', (formula, counts) => expect(parseFormula(formula)).toEqual(counts))

  // BUG: the number after a group in parentheses is ignored.
  it.fails('BUG: counts a group in parentheses', () => expect(parseFormula('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 }))
  // BUG: the number in front of a hydrate is ignored.
  it.fails('BUG: counts a hydrate after a dot', () => expect(parseFormula('CuSO4.5H2O')).toEqual({ Cu: 1, S: 1, O: 9, H: 10 }))
})
