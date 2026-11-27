// Stage 1, part B: unit conversions. All inputs are made-up numbers, not chemical data;
// expected results are plain unit arithmetic.
//
// Tests written with `it.fails` describe the CORRECT behaviour that the app does not have
// yet (a known bug, not fixed on purpose). Vitest reports them as "expected fail". Once a
// bug is fixed, its test starts failing: change `it.fails` to `it`.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  convertPressure, convertTemperature, densityForCard, temperatureForCard, tidy, vapourPressureForCard,
} from './units.ts'
import { cellsFor, sourceRows, toCsv } from './table.ts'
import { buildExperimentPdf } from './pdf.ts'
import CardScreen from '../screens/CardScreen.tsx'
import type { ChemicalCard, Field, FieldKey } from '../types/card.ts'

describe('B1: °F and K to °C, one decimal', () => {
  it.each([
    ['32 °F', '0 °C'],
    ['212 °F', '100 °C'],
    ['-40 °F', '-40 °C'],
    ['-4 °F', '-20 °C'],
    ['98.6 °F', '37 °C'],
    ['100 °F', '37.8 °C'],
    ['212°F', '100 °C'],
    ['212 ° F', '100 °C'],
    ['212 °f', '100 °C'],
    ['273.15 K', '0 °C'],
    ['373.15 K', '100 °C'],
    ['300.18 K', '27 °C'],
  ])('%s -> %s', (input, out) => expect(convertTemperature(input)).toBe(out))
})

describe('B2: pressure to mmHg, three significant figures', () => {
  it.each([
    ['10 kPa', '75 mmHg'],
    ['12.34 kPa', '92.6 mmHg'],
    ['100 Pa', '0.75 mmHg'],
    ['1 bar', '750 mmHg'],
    ['2 atm', '1520 mmHg'],
    ['5 torr', '5 mmHg'], // torr is treated as equal to mmHg
    ['10 KPA', '75 mmHg'],
    ['5 Torr', '5 mmHg'],
    ['10kPa', '75 mmHg'],
  ])('%s -> %s', (input, out) => expect(convertPressure(input)).toBe(out))
})

describe('B3: values already in the card units get no "converted" label', () => {
  it.each(['50 °C', '-5 °C', '50°C'])('temperature %s', (v) => {
    expect(convertTemperature(v)).toBeUndefined()
    expect(temperatureForCard(v).converted).toBeUndefined()
  })
  it.each(['5 mmHg', '5 mmHg at 20 °C', '5 mm Hg at 20 °C'])('pressure %s', (v) => {
    expect(vapourPressureForCard(v).converted).toBeUndefined()
  })
  it('density in g/mL', () => expect(densityForCard('1.5 g/mL at 20 °C').converted).toBeUndefined())
})

describe('B4: qualifiers survive the conversion', () => {
  it.each(['greater than ', 'less than ', 'more than ', '> ', '>= ', '< ', '<= ', 'about ', 'approx. ', 'approx '])('"%s"', (q) => {
    expect(convertTemperature(`${q}212 °F`)).toBe(`${q}100 °C`)
    expect(temperatureForCard(`${q}212 °F`).converted).toBe(`${q}100 °C`)
    expect(convertPressure(`${q}10 kPa`)).toBe(`${q}75 mmHg`)
    expect(vapourPressureForCard(`${q}10 kPa at 20 °C`).converted).toBe(`${q}75 mmHg at 20 °C`)
  })
})

describe('B5: never half-convert', () => {
  it.each([
    '133-135 °F', '133 - 135 °F', '133 to 135 °F', '1,013 °F', '−4 °F', // the last one has a Unicode minus
    '2.5X10+2 °F', '≥ 212 °F',
  ])('temperature "%s" is left as written', (v) => {
    expect(convertTemperature(v)).toBeUndefined()
    expect(temperatureForCard(v)).toEqual({ shown: v })
  })

  it.each([
    '10-20 kPa', '10 to 20 kPa', '1,013 kPa', '2.5X10-2 kPa', '2.5e-2 kPa', '−1 kPa',
    '10 hPa', '10 mbar', '10 mPa', '10 MPa', '10 psi',
  ])('pressure "%s" is left as written', (v) => {
    expect(convertPressure(v)).toBeUndefined()
    expect(vapourPressureForCard(v)).toEqual({ shown: v })
  })

  it('a pressure range with a °F temperature: only the temperature changes, the unit stays visible', () => {
    expect(vapourPressureForCard('10-20 kPa at 68 °F'))
      .toEqual({ shown: '10-20 kPa at 68 °F', converted: '10-20 kPa at 20 °C', from: '68 °F' })
  })

  // BUG: gives "100 °C to 220 °F": two units in one value.
  it.fails('BUG: a range that repeats °F is converted completely or not at all (with "to")', () => {
    expect(temperatureForCard('212 °F to 220 °F').converted ?? '').not.toContain('°F')
  })
  // BUG: gives "100 °C - 220 °F".
  it.fails('BUG: a range that repeats °F is converted completely or not at all (with a dash)', () => {
    expect(temperatureForCard('212 °F - 220 °F').converted ?? '').not.toContain('°F')
  })
  // BUG: gives "75 mmHg - 20 kPa at 20 °C".
  it.fails('BUG: a range that repeats kPa is converted completely or not at all', () => {
    expect(vapourPressureForCard('10 kPa - 20 kPa at 20 °C').converted ?? '').not.toContain('kPa')
  })
})

describe('B6: a measuring condition is never taken for the value', () => {
  it('a measuring temperature is not converted as a pressure value', () => {
    expect(convertTemperature('5 mmHg at 68 °F')).toBeUndefined()
  })
  it('a measuring pressure is not converted as a temperature value', () => {
    expect(convertPressure('212 °F at 101 kPa')).toBeUndefined()
  })
  it('the measuring pressure stays as written when the boiling point is converted', () => {
    expect(temperatureForCard('212 °F at 101 kPa'))
      .toEqual({ shown: '212 °F at 101 kPa', converted: '100 °C at 101 kPa', from: '212 °F' })
  })
})

describe('B7: vapour pressure picks the value measured closest to 20 °C', () => {
  const shown = (v: string) => vapourPressureForCard(v).shown
  it('compares °F and °C on the same scale', () => {
    expect(shown('1 mmHg at 50 °C ; 2 mmHg at 68 °F ; 3 mmHg at 30 °C')).toBe('2 mmHg at 68 °F')
  })
  it('takes the first of two equally close values', () => {
    expect(shown('1 mmHg at 15 °C ; 2 mmHg at 25 °C')).toBe('1 mmHg at 15 °C')
  })
  it('prefers a value with a temperature over one without', () => {
    expect(shown('1 mmHg ; 2 mmHg at 80 °C')).toBe('2 mmHg at 80 °C')
  })
  it('takes the first value when none has a temperature', () => expect(shown('1 mmHg ; 2 mmHg')).toBe('1 mmHg'))
  it('skips empty parts', () => expect(shown(' ; 1 mmHg ; ; ')).toBe('1 mmHg'))
  it('reads "@" as "at"', () => expect(shown('1 mmHg @ 50 °C ; 2 mmHg @ 20 °C')).toBe('2 mmHg at 20 °C'))
  // BUG (limitation): a temperature in kelvin is ignored, so the 100 °C value is chosen.
  it.fails('BUG: a temperature in K counts too', () => {
    expect(shown('1 mmHg at 100 °C ; 2 mmHg at 293.15 K')).toBe('2 mmHg at 293.15 K')
  })
})

describe('B8: the ICSC form "Vapour pressure, kPa at 20 °C: ..."', () => {
  it.each([
    ['Vapour pressure, kPa at 20 °C: 10', '75 mmHg at 20 °C', '10 kPa'],
    ['Vapor pressure, kPa at 20 °C: 10', '75 mmHg at 20 °C', '10 kPa'],
    ['Vapour pressure, Pa at 20 °C: 100', '0.75 mmHg at 20 °C', '100 Pa'],
    ['Vapour pressure, Pa at 25 °C: 100 - 200', '0.75 - 1.5 mmHg at 25 °C', '100 - 200 Pa'],
  ])('%s', (input, converted, from) => {
    expect(vapourPressureForCard(input)).toMatchObject({ converted, from })
  })
  it.each([
    'Vapour pressure, kPa at 20 °C: <10',
    'Vapour pressure, kPa at 20 °C: negligible',
    'Vapour pressure, kPa at 20 °C: 10 (calculated)',
  ])('an unmatched form is left as written: %s', (v) => expect(vapourPressureForCard(v)).toEqual({ shown: v }))
})

describe('B9: density', () => {
  it.each(['g/cu cm', 'g/cu. cm', 'g/cm³', 'g/cm3', 'g/cc', 'g / cu cm'])('"%s" is spelled g/mL, digits unchanged', (u) => {
    expect(densityForCard(`1.2500 ${u}`)).toEqual({ shown: '1.2500 g/mL' })
  })
  it.each(['1250 kg/m³', '10 lb/gal', '5 g/L'])('does not relabel "%s"', (v) => {
    expect(densityForCard(v)).toEqual({ shown: v })
  })
  it('adds "at" before a °C measuring temperature', () => {
    expect(densityForCard('1.25 g/cu cm 20 °C')).toEqual({ shown: '1.25 g/mL at 20 °C' })
  })
  it('converts a °F measuring temperature written with "at"', () => {
    expect(densityForCard('1.25 g/cu cm at 68 °F'))
      .toEqual({ shown: '1.25 g/mL at 68 °F', converted: '1.25 g/mL at 20 °C', from: '68 °F' })
  })
  // BUG (minor): without the word "at", a °F measuring temperature is not converted.
  it.fails('BUG: converts a °F measuring temperature written without "at"', () => {
    expect(densityForCard('1.25 g/cu cm 68 °F').converted).toBe('1.25 g/mL at 20 °C')
  })
})

describe('B10: tidy() removes source notes only', () => {
  it.each(['(NTP, 1992)', '(USCG, 1999)', '(NIOSH, 2024)'])('removes the citation %s', (c) => {
    expect(tidy(`5 mmHg ${c}`)).toBe('5 mmHg')
  })
  it.each(['5 mmHg (approx)', '> 5 mmHg', '5 mmHg (estimated)', '5 mmHg (at 20 °C)', '1.2500', 'less than 1'])(
    'keeps "%s" unchanged', (v) => expect(tidy(v)).toBe(v))
})

describe('B11: conversion is display only, and every output agrees', () => {
  const field = (value: string, extra: Partial<Field> = {}): Field => ({
    value, source: 'pubchem', source_url: 'https://pubchem.ncbi.nlm.nih.gov/compound/1',
    retrieved_at: '2026-01-01', origin: 'source', status: 'pending', ...extra,
  })
  const fields: Partial<Record<FieldKey, Field>> = {
    name: field('T'),
    bp: field('212 °F'),
    mp: field('32 °F'),
    density: field('1.25 g/cu cm at 68 °F'),
    vapor_pressure: field('10 kPa at 68 °F'),
  }
  const card: ChemicalCard = { id: 'cid-1', created_at: '2026-01-01', updated_at: '2026-01-01', fields }
  const before = structuredClone(card)
  const converted = ['100 °C', '0 °C', '1.25 g/mL at 20 °C', '75 mmHg at 20 °C']

  it('the table cells show the converted value and what it was converted from', () => {
    const c = cellsFor(card)
    expect(c.bpmp).toBe('BP: 100 °C (converted from 212 °F)\nMP: 0 °C (converted from 32 °F)')
    expect(c.density).toBe('1.25 g/mL at 20 °C (converted from 68 °F)')
    expect(c.vp).toBe('75 mmHg at 20 °C (converted from 10 kPa at 68 °F)')
  })
  it('the CSV has the same text', () => {
    const csv = toCsv([card])
    for (const v of converted) expect(csv).toContain(v)
    expect(csv).toContain('(converted from 10 kPa at 68 °F)')
  })
  it('the card screen shows the converted value, the label and the original text', () => {
    const noop = async () => {}
    const html = renderToStaticMarkup(createElement(CardScreen, { card, saved: true, onSave: noop, onDelete: noop, onBack: () => {} }))
    for (const v of converted) expect(html).toContain(v)
    expect(html).toContain('<em>converted from 212 °F</em>')
    for (const k of ['bp', 'mp', 'density', 'vapor_pressure'] as const) expect(html).toContain(fields[k]!.value)
  })
  it('the sources list keeps the original text', () => {
    const values = sourceRows([card]).map((r) => r.value)
    for (const f of Object.values(fields)) expect(values).toContain(f!.value)
  })
  it('the PDF has the converted and the original values', async () => {
    const text = new TextDecoder('latin1').decode(await buildExperimentPdf('T', [card], '2026-01-01'))
    // short pieces only: the PDF wraps long cell text over several lines
    for (const v of ['100 °C', '75 mmHg', '212 °F', '10 kPa', 'g/cu cm']) expect(text).toContain(v)
  })
  it('a relative density gets no unit', () => {
    const rel = { ...card, fields: { density: field('1.25 at 68 °F', { quantity: 'relative_density' }) } }
    expect(cellsFor(rel).density).toBe('relative density 1.25 at 20 °C (converted from 68 °F)')
  })
  it('none of this changes the stored card', () => expect(card).toEqual(before))
})
