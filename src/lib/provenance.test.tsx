import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'
import { approveCard, editField } from './cards.ts'
import { documentedReference, isNotVerified } from './provenance.ts'
import { cellsFor, sourceRows, toCsv } from './table.ts'
import CardScreen from '../screens/CardScreen.tsx'
import NfpaDiamond from '../components/NfpaDiamond.tsx'

const cards = demo as unknown as ChemicalCard[]
const by = (cas: string) => cards.find((c) => c.cas?.value === cas)!
const acetone = by('67-64-1')
const ethanol = by('64-17-5')
const noop = async () => {}
// "TEST" is a placeholder, not chemical data.

describe('values typed in by hand', () => {
  const c = approveCard(editField(ethanol, 'bp', 'TEST'))
  it('stay "Not verified" after approval', () => expect(isNotVerified(c, 'bp')).toBe(true))
  it('say so in the table, CSV and sources page, with no link', () => {
    expect(cellsFor(c).bpmp).toContain('BP: TEST (Not verified)')
    expect(toCsv([c])).toContain('TEST (Not verified)')
    const row = sourceRows([c]).find((r) => r.field.startsWith('Boiling'))!
    expect(row.source).toBe('Not verified (entered by hand)')
    expect(row.url).toBe('')
  })
  it('say so on the card screen', () => {
    const html = renderToStaticMarkup(<CardScreen card={c} saved onSave={noop} onDelete={noop} onBack={() => {}} />)
    expect(html).toContain('>Not verified</a>')
  })
  it('are starred in the NFPA diamond', () => {
    const html = renderToStaticMarkup(<NfpaDiamond card={editField(ethanol, 'nfpa_fire', 'TEST')} />)
    expect(html).toContain('TEST*')
    expect(html).toContain('* Not verified')
    expect(renderToStaticMarkup(<NfpaDiamond card={ethanol} />)).not.toContain('Not verified')
  })
  it('include names and a waste container chosen by hand', () => {
    expect(isNotVerified(by('64-19-7'), 'name')).toBe(true)
    expect(cellsFor(editField(ethanol, 'waste_container', 'inorganic')).waste).toBe('inorganic (Not verified)')
  })
  it('do not include source values or rule suggestions', () => {
    expect(isNotVerified(ethanol, 'bp')).toBe(false)
    expect(isNotVerified(ethanol, 'waste_container')).toBe(false)
    expect(cellsFor(ethanol).bpmp).not.toContain('Not verified')
  })
  it('include an "SDS" value whose SDS is not named', () => {
    const f = { ...ethanol.fields.bp!, source: 'sds' as const, origin: 'user' as const, upstream: undefined }
    expect(isNotVerified({ ...ethanol, fields: { ...ethanol.fields, bp: f } }, 'bp')).toBe(true)
  })
})

describe('documented CRC correction (acetone density)', () => {
  it('shows the handbook as the source', () => {
    expect(documentedReference(acetone, 'density')).toBe('CRC Handbook 107th ed.')
    expect(isNotVerified(acetone, 'density')).toBe(false)
  })
  it('is lost when the value is edited', () => {
    const e = editField(acetone, 'density', 'TEST', 'Corrected after manual check against CRC Handbook 107th ed.')
    expect(documentedReference(e, 'density')).toBeUndefined()
    expect(isNotVerified(e, 'density')).toBe(true)
  })
  it('does not carry to another chemical', () => {
    const copy = { ...ethanol, fields: { ...ethanol.fields, density: acetone.fields.density! } }
    expect(isNotVerified(copy, 'density')).toBe(true)
  })
})
