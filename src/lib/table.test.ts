import { describe, expect, it } from 'vitest'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'
import { COLUMNS, cellsFor, EMPTY_CELL, sourceRows, toCsv } from './table.ts'

const cards = demo as unknown as ChemicalCard[]
const by = (cas: string) => cards.find((c) => c.cas?.value === cas)!

describe('column order (the lab form)', () => {
  it('is name, formula, MW, BP/MP, density, vapour pressure, waste, NFPA x4, exposure x4', () => {
    expect(COLUMNS.map((c) => c.id)).toEqual(['name', 'formula', 'mw', 'bpmp', 'density', 'vp', 'waste',
      'fire', 'health', 'reactivity', 'special', 'eyes', 'skin', 'inhalation', 'ingestion'])
    expect(COLUMNS.filter((c) => c.group === 'NFPA 704')).toHaveLength(4)
    expect(COLUMNS.filter((c) => c.group === 'Exposure hazards')).toHaveLength(4)
  })
})

describe('cells', () => {
  const a = cellsFor(by('67-64-1'))
  it('puts BP and MP in one cell', () => expect(a.bpmp).toBe('BP: 56.08 °C\nMP: -94.9 °C'))
  it('names the documented reference on the hand-corrected density', () => expect(a.density).toBe('0.7902 g/mL at 20 °C (CRC Handbook 107th ed.)'))
  it('vapour pressure: first value, converted temperature', () => expect(a.vp).toBe('180 mmHg at 20 °C (converted from 68 °F)'))
  it('marks a name typed by hand as not verified', () => {
    const c = by('64-19-7')
    const f = { ...c, fields: { ...c.fields, name: { ...c.fields.name!, value: 'Acetic acid (glacial)', origin: 'user' as const } } }
    expect(cellsFor(f).name).toBe('Acetic acid (glacial) (Not verified)')
  })
  it('shows g/cu cm densities in g/mL, number untouched', () => expect(cellsFor(by('64-19-7')).density).toMatch(/^1\.0446 g\/mL at 25 °C/))
  it('marks the unconfirmed waste container', () => expect(a.waste).toBe('organic †'))
  it('empty special hazard is the empty marker', () => expect(a.special).toBe(EMPTY_CELL))
  it('has the NFPA special symbol where PubChem gave one', () => expect(cellsFor(by('7722-84-1')).special).toBe('OX'))
  it('exposure text is copied as is', () => expect(a.eyes).toBe('Redness. Pain. Blurred vision.'))
  it('converts a °F boiling point and says so', () => {
    const c = by('67-64-1')
    const f = { ...c, fields: { ...c.fields, bp: { ...c.fields.bp!, value: '133 °F at 760 mmHg', origin: 'source' as const } } }
    expect(cellsFor(f).bpmp).toContain('56.1 °C at 760 mmHg (converted from 133 °F)')
  })
  it('does not invent values for a missing field', () => {
    const c = by('67-64-1')
    const { bp: _bp, ...rest } = c.fields
    void _bp
    expect(cellsFor({ ...c, fields: rest }).bpmp).toBe(`BP: ${EMPTY_CELL}\nMP: -94.9 °C`)
  })
})

describe('CSV', () => {
  const csv = toCsv(cards)
  const lines = csv.slice(1).trim().split('\r\n')
  it('starts with a BOM and has a header + one row per chemical', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(lines.length).toBeGreaterThanOrEqual(1 + 5)
  })
  it('header uses the lab form columns', () => {
    expect(lines[0]).toContain('Chemical name,Formula,MW (g/mol),BP / MP (°C),Density (g/mL),Vapour pressure (mmHg),Waste container,NFPA 704: Fire')
    expect(lines[0]).toContain('Exposure hazards: Ingestion')
  })
  it('quotes cells that contain commas, quotes or line breaks', () => {
    const c = by('67-64-1')
    const tricky = { ...c, fields: { ...c.fields, name: { ...c.fields.name!, value: 'A, "B"' } } }
    expect(toCsv([tricky])).toContain('"A, ""B"""')
  })
  it('leaves missing values blank, not "–"', () => {
    expect(toCsv([by('67-64-1')])).not.toContain(EMPTY_CELL)
  })
})

describe('sources list', () => {
  const rows = sourceRows([by('67-64-1')])
  it('has a row for every value on the card', () => expect(rows).toHaveLength(Object.keys(by('67-64-1').fields).length))
  it('keeps the full original vapour pressure text', () => {
    expect(rows.find((r) => r.field.startsWith('Vapour'))!.value).toBe('180 mmHg at 68 °F ; 270 mmHg at 86 °F (NTP, 1992)')
  })
  it('records the manual density correction and what the source had', () => {
    const d = rows.find((r) => r.field.startsWith('Density'))!
    expect(d.detail).toContain('Corrected after manual check against CRC Handbook 107th ed.')
    expect(d.detail).toContain('Source had: 0.7845 g/cu cm at 20 °C')
    expect(d.source).toBe('CRC Handbook 107th ed.')
    expect(d.url).toBe('')
  })
  it('names the original supplier in full', () => {
    expect(rows.find((r) => r.field === 'Boiling point (°C)')!.source).toContain('Hazardous Substances Data Bank (HSDB)')
  })
})
