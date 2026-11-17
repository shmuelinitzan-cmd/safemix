import { describe, expect, it } from 'vitest'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'
import { editField, makeSolutionCard } from './cards.ts'
import { cellsFor, sourceRows } from './table.ts'
import { LIBRARY_FORMAT, LIBRARY_VERSION, parseLibraryFile as parseLibrary } from './library-io.ts'

const cards = demo as unknown as ChemicalCard[]
const acetic = cards.find((c) => c.cas?.value === '64-19-7')!
// The citation and value below are placeholders for the test, not real SDS data.
const SDS = { citation: 'Test Supplier SDS 123, rev. 2026-01-01', url: 'https://example.com/sds.pdf' }

describe('values typed in from a supplier SDS', () => {
  const c = editField(acetic, 'nfpa_special', 'TEST', undefined, SDS)
  const f = c.fields.nfpa_special!
  it('is recorded as source "sds" with the citation and link', () => {
    expect(f.source).toBe('sds')
    expect(f.origin).toBe('user')
    expect(f.upstream).toBe(SDS.citation)
    expect(f.source_url).toBe(SDS.url)
  })
  it('is marked (SDS) in the table, and the SDS is named on the sources page', () => {
    expect(cellsFor(c).special).toBe('TEST (SDS)')
    const row = sourceRows([c]).find((r) => r.field === 'NFPA 704 Special')!
    expect(row.source).toBe(`Supplier SDS: ${SDS.citation}`)
  })
  it('drops a link that is not https', () => {
    expect(editField(acetic, 'mp', 'X', undefined, { citation: 'A', url: 'javascript:alert(1)' }).fields.mp!.source_url).toBe('')
  })
  it('without a citation it stays "entered by hand"', () => {
    const h = editField(acetic, 'mp', 'X')
    expect(h.fields.mp!.source).toBe('user')
    expect(cellsFor(h).bpmp).toContain('(edited)')
  })
})

describe('solution cards', () => {
  const s = makeSolutionCard(acetic, '5% w/w aqueous')
  it('names the solution and links it to the pure compound', () => {
    expect(s.fields.name!.value).toBe('Acetic acid (glacial), 5% w/w aqueous')
    expect(s.concentration).toBe('5% w/w aqueous')
    expect(s.parent_id).toBe(acetic.id)
    expect(s.id).toBe(`${acetic.id}-sol-5-w-w-aqueous`)
  })
  it('keeps only formula, MW and the waste suggestion; pure-compound values are not copied', () => {
    expect(Object.keys(s.fields).sort()).toEqual(['formula', 'mw', 'name', 'waste_container'])
    expect(s.fields.mw!.value).toBe(acetic.fields.mw!.value)
  })
  it('survives JSON export and import', () => {
    const back = parseLibrary(JSON.stringify({ format: LIBRARY_FORMAT, version: LIBRARY_VERSION, exported_at: '2026-11-17', cards: [s, editField(s, 'bp', '100 °C', undefined, SDS)], experiments: [] }))
    expect(back.cards[0].concentration).toBe('5% w/w aqueous')
    expect(back.cards[1].fields.bp!.source).toBe('sds')
  })
  it('refuses an empty concentration', () => expect(() => makeSolutionCard(acetic, '  ')).toThrow())
})
