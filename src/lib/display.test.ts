import { describe, expect, it } from 'vitest'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'
import { vapourPressureForCard } from './units.ts'
import { shortSource } from './sources.ts'

const cards = demo as unknown as ChemicalCard[]

describe('vapour pressure on the card', () => {
  it('shows only the first value with its temperature, and converts that temperature', () => {
    expect(vapourPressureForCard('180 mmHg at 68 °F ; 270 mmHg at 86 °F (NTP, 1992)')).toEqual({ shown: '180 mmHg at 68 °F', converted: '180 mmHg at 20 °C' })
    expect(vapourPressureForCard('40 mmHg at 66 °F ; 50 mmHg at 77 °F (NTP, 1992)')).toEqual({ shown: '40 mmHg at 66 °F', converted: '40 mmHg at 18.9 °C' })
    expect(vapourPressureForCard('11.4 mmHg at 68 °F ; 20 mmHg at 86 °F (NTP, 1992)')).toEqual({ shown: '11.4 mmHg at 68 °F', converted: '11.4 mmHg at 20 °C' })
  })
  it('drops the trailing citation from a single value but keeps "(approx)"', () => {
    expect(vapourPressureForCard('1 mmHg at 59.5 °F (NTP, 1992)')).toEqual({ shown: '1 mmHg at 59.5 °F', converted: '1 mmHg at 15.3 °C' })
    expect(vapourPressureForCard('0 mmHg (approx) (NIOSH, 2024)')).toEqual({ shown: '0 mmHg (approx)' })
  })
  it('has no conversion when everything is already in mmHg and °C', () => {
    expect(vapourPressureForCard('30 mmHg at 20 °C').converted).toBeUndefined()
  })
  it('converts another pressure unit to mmHg', () => {
    expect(vapourPressureForCard('24 kPa at 20 °C').converted).toBe('180 mmHg at 20 °C')
  })
  it('never changes the stored text of the demo cards', () => {
    expect(cards.find((c) => c.cas?.value === '67-64-1')!.fields.vapor_pressure!.value).toBe('180 mmHg at 68 °F ; 270 mmHg at 86 °F (NTP, 1992)')
  })
})

describe('short source names', () => {
  it.each([
    ['Hazardous Substances Data Bank (HSDB)', 'HSDB'],
    ['ILO-WHO International Chemical Safety Cards (ICSCs)', 'ICSC'],
    ['Australian Industrial Chemicals Introduction Scheme (AICIS)', 'AICIS'],
    ['CAMEO Chemicals', 'CAMEO'],
    ['Occupational Safety and Health Administration (OSHA)', 'OSHA'],
    ['PubChem record title', 'PubChem'],
  ])('%s -> %s', (full, short) => expect(shortSource(full)).toBe(short))
  it('shows an unknown name whole instead of guessing', () => expect(shortSource('Some Other Source')).toBe('Some Other Source'))
  it('every source in the demo cards gets a short name', () => {
    const names = new Set(cards.flatMap((c) => Object.values(c.fields).map((f) => f!.upstream)).filter(Boolean))
    for (const n of names) expect(shortSource(n)!.length).toBeLessThanOrEqual(8)
  })
})
