import { describe, expect, it } from 'vitest'
import { convertPressure, convertTemperature } from './units.ts'
import { suggestWaste } from './waste.ts'
import { BARE_RELATIVE, extractCondition, IN_CELSIUS, IN_G_PER_ML, parseRecord } from './pubchem.ts'

describe('units (display only)', () => {
  it('converts a leading °F value', () => expect(convertTemperature('133 °F at 760 mmHg (NTP, 1992)')).toBe('56.1 °C'))
  it('keeps the qualifier', () => expect(convertTemperature('greater than 266 °F at 760 mmHg')).toBe('greater than 130 °C'))
  it('does not convert a value already in °C', () => expect(convertTemperature('56 °C')).toBeUndefined())
  it('does not convert the measuring temperature', () => expect(convertPressure('180 mmHg at 68 °F')).toBeUndefined())
  it('converts kPa to mmHg', () => expect(convertPressure('24 kPa at 20 °C')).toBe('180 mmHg'))
})

describe('waste rule', () => {
  it('carbon, no halogen -> organic', () => expect(suggestWaste('C3H6O').category).toBe('organic'))
  it('carbon + halogen -> halogenated organic', () => expect(suggestWaste('CH2Cl2').category).toBe('halogenated organic'))
  it('H + halogen -> acidic inorganic', () => expect(suggestWaste('ClH').category).toBe('acidic inorganic'))
  it('oxoacid pattern -> acidic inorganic', () => expect(suggestWaste('H2O4S').category).toBe('acidic inorganic'))
  it('metal hydroxide -> basic', () => expect(suggestWaste('HNaO').category).toBe('basic'))
  it('H and O only -> inorganic', () => expect(suggestWaste('H2O2').category).toBe('inorganic'))
})

describe('condition extraction', () => {
  it('finds a stated concentration', () => expect(extractCondition('Stable /solution (>/= 30% to <50%)/')).toBe('>/= 30% to <50%'))
  it('ignores a number that is the value', () => expect(extractCondition('111 % (NIOSH, 2024)')).toBeUndefined())
  it('returns nothing when none is stated', () => expect(extractCondition('56.08 °C')).toBeUndefined())
})

describe('value rule (BP / MP / density)', () => {
  it('recognises °C values', () => {
    expect(IN_CELSIUS.test('56.08 °C')).toBe(true)
    expect(IN_CELSIUS.test('-95 °C')).toBe(true)
    expect(IN_CELSIUS.test('133 °F at 760 mmHg')).toBe(false)
  })
  it('recognises g/mL and g/cm³ values', () => {
    expect(IN_G_PER_ML.test('0.7845 g/cm³ at 25 °C')).toBe(true)
    expect(IN_G_PER_ML.test('0.79 g/mL')).toBe(true)
    expect(IN_G_PER_ML.test('0.79 at 68 °F')).toBe(false)
  })
  it('recognises bare relative-density values', () => {
    expect(BARE_RELATIVE.test('0.791 at 68 °F (USCG, 1999)')).toBe(true)
    expect(BARE_RELATIVE.test('Relative density (water = 1): 0.8')).toBe(true)
    expect(BARE_RELATIVE.test('8.8 lb / gal')).toBe(false)
  })
  const rec = (vals: string[]) => ({
    RecordNumber: 1, RecordTitle: 'T', Reference: [],
    Section: [{ TOCHeading: 'Boiling Point', Information: vals.map((v) => ({ ReferenceNumber: 1, Value: { StringWithMarkup: [{ String: v }] } })) },
              { TOCHeading: 'Density', Information: vals.map((v) => ({ ReferenceNumber: 1, Value: { StringWithMarkup: [{ String: v }] } })) }],
  })
  it('prefers a later °C value over an earlier °F one', () => {
    expect(parseRecord(rec(['133 °F at 760 mmHg', '56 °C']), '2026-01-01').fields.bp?.value).toBe('56 °C')
  })
  it('falls back to the first listed value', () => {
    expect(parseRecord(rec(['133 °F', '140 °F']), '2026-01-01').fields.bp?.value).toBe('133 °F')
  })
  it('tags a bare density as relative density', () => {
    const f = parseRecord(rec(['0.79 at 68 °F', 'something else']), '2026-01-01').fields.density
    expect(f?.quantity).toBe('relative_density')
  })
  it('does not tag a g/mL density', () => {
    const f = parseRecord(rec(['0.79 at 68 °F', '0.7845 g/cm³']), '2026-01-01').fields.density
    expect(f?.value).toBe('0.7845 g/cm³')
    expect(f?.quantity).toBeUndefined()
  })
})
