import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { SafeMixDB, seedDemo } from './db.ts'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'
import { approveCard, editField, matches } from './cards.ts'
import { cellsFor, toCsv } from './table.ts'
import { exportLibrary, parseLibraryFile } from './library-io.ts'

describe('storage', () => {
  it('seeds the 5 demo cards once', async () => {
    const d = new SafeMixDB('test-seed')
    expect(await seedDemo(d)).toBe(true)
    expect(await d.cards.count()).toBe(5)
    await d.cards.delete('cas-67-64-1')
    expect(await seedDemo(d)).toBe(false) // a deleted demo card is not brought back
    expect(await d.cards.count()).toBe(4)
  })
})

describe('"not verified" mark', () => {
  const cards = demo as unknown as ChemicalCard[]
  const peroxide = cards.find((c) => c.cas?.value === '7722-84-1')!
  it('is on the hydrogen peroxide demo card only', () => {
    expect(cards.filter((c) => c.not_verified).map((c) => c.id)).toEqual([peroxide.id])
    expect(peroxide.not_verified).toBe('Concentration not verified')
  })
  it('is added to a card stored before the mark existed, without changing its values', async () => {
    const d = new SafeMixDB('test-mark')
    await seedDemo(d, cards.map((c) => ({ ...c, not_verified: undefined })))
    await seedDemo(d)
    expect(await d.cards.get(peroxide.id)).toEqual(peroxide)
  })
  it('does not bring back a deleted card', async () => {
    const d = new SafeMixDB('test-mark-deleted')
    await seedDemo(d)
    await d.cards.delete(peroxide.id)
    await seedDemo(d)
    expect(await d.cards.get(peroxide.id)).toBeUndefined()
  })
  it('stays through approval, tables and library export / import', () => {
    expect(approveCard(peroxide).not_verified).toBe(peroxide.not_verified)
    expect(cellsFor(peroxide).name).toContain('Concentration not verified')
    expect(toCsv([peroxide])).toContain('Concentration not verified')
    expect(parseLibraryFile(exportLibrary([peroxide], [])).cards[0].not_verified).toBe(peroxide.not_verified)
  })
})

describe('demo cards', () => {
  const cards = demo as unknown as ChemicalCard[]
  const acetone = cards.find((c) => c.cas?.value === '67-64-1')!
  it('has the 5 chosen chemicals', () => {
    expect(cards.map((c) => c.cas?.value).sort()).toEqual(['1310-73-2', '64-17-5', '64-19-7', '67-64-1', '7722-84-1'])
  })
  it('keeps the manual acetone density correction with the PubChem value', () => {
    const f = acetone.fields.density!
    expect(f.value).toBe('0.7902 g/cm³ at 20 °C')
    expect(f.origin).toBe('user')
    expect(f.source_value).toBe('0.7845 g/cu cm at 20 °C')
    expect(f.note).toContain('CRC Handbook 107th ed.')
  })
  it('leaves empty special-hazard fields empty', () => {
    expect(acetone.fields.nfpa_special).toBeUndefined()
  })
  it('keeps the waste container pending', () => {
    for (const c of cards) expect(c.fields.waste_container?.status).toBe('pending')
  })
})

describe('card helpers', () => {
  const card = (demo as unknown as ChemicalCard[])[0]
  it('editing marks a value as user-set and keeps what the source said', () => {
    const e = editField(card, 'bp', '57 °C')
    expect(e.fields.bp).toMatchObject({ value: '57 °C', origin: 'user', status: 'pending', source_value: card.fields.bp!.value })
  })
  it('emptying a field removes it', () => expect(editField(card, 'bp', '  ').fields.bp).toBeUndefined())
  it('approve accepts everything on the card', () => {
    const a = approveCard(editField(card, 'bp', '57 °C'))
    expect(Object.values(a.fields).every((f) => f!.status === 'approved')).toBe(true)
  })
  it('search matches name, formula and CAS', () => {
    expect(matches(card, 'aceto')).toBe(true)
    expect(matches(card, 'c3h6o')).toBe(true)
    expect(matches(card, '67-64')).toBe(true)
    expect(matches(card, 'zzz')).toBe(false)
  })
})
