import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { SafeMixDB, seedDemo } from './db.ts'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'
import { approveCard, editField, matches } from './cards.ts'

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
