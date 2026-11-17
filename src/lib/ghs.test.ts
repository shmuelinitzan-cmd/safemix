import { describe, expect, it } from 'vitest'
import { ghsStatements, parseRecord } from './pubchem.ts'
import { cardFromLookup } from './cards.ts'
import { cellsFor, ghsInsteadOfNfpa, toCsv } from './table.ts'
import { densityForCard, temperatureForCard, tidy, vapourPressureForCard } from './units.ts'

// A minimal PubChem record shaped like the real PUG View answer (strings copied from the
// iodoform record, CID 6374). Test data only, used to check the parsing rule.
const ECHA = { ReferenceNumber: 22, SourceName: 'European Chemicals Agency (ECHA)' }
const NITE = { ReferenceNumber: 48, SourceName: 'NITE-CMC' }
const swm = (lines: string[]) => ({ Value: { StringWithMarkup: lines.map((String) => ({ String })) } })
function record(ghsLines: string[], extra: object[] = []) {
  return {
    RecordNumber: 6374, RecordTitle: 'Iodoform', Reference: [ECHA, NITE],
    Section: [{ TOCHeading: 'GHS Classification', Information: [
      { Name: 'GHS Hazard Statements', ReferenceNumber: 22, ...swm(ghsLines) },
      { Name: 'GHS Hazard Statements', ReferenceNumber: 48, ...swm(['H336: May cause drowsiness or dizziness [Warning Specific target organ toxicity]']) },
    ] }, ...extra],
  }
}
const IODOFORM = [
  'H302 (> 99.9%): Harmful if swallowed [Warning Acute toxicity, oral]',
  'H312 (99.1%): Harmful in contact with skin [Warning Acute toxicity, dermal]',
  'H315 (99.9%): Causes skin irritation [Warning Skin corrosion/irritation]',
  'H319 (99.9%): Causes serious eye irritation [Warning Serious eye damage/eye irritation]',
  'H332 (99%): Harmful if inhaled [Warning Acute toxicity, inhalation]',
  'H372 (20%): Causes damage to organs [Danger Specific target organ toxicity]',
]

describe('GHS fallback for exposure columns', () => {
  it('uses the ECHA entry and drops codes fewer than half of the notifiers reported', () => {
    const g = ghsStatements(record(IODOFORM))!
    expect(g.info.ReferenceNumber).toBe(22)
    expect(g.statements.map((s) => s.code)).toEqual(['H302', 'H312', 'H315', 'H319', 'H332'])
  })
  it('sorts statements to routes, text copied without percentage or class', () => {
    const f = parseRecord(record(IODOFORM), '2026-11-17').fields
    expect(f.exp_eyes?.value).toBe('H319: Causes serious eye irritation')
    expect(f.exp_skin?.value).toBe('H312: Harmful in contact with skin; H315: Causes skin irritation')
    expect(f.exp_inhalation?.value).toBe('H332: Harmful if inhaled')
    expect(f.exp_ingestion?.value).toBe('H302: Harmful if swallowed')
    expect(f.exp_eyes?.upstream).toBe('European Chemicals Agency (ECHA)')
    expect(f.exp_eyes?.source_url).toContain('#section=GHS-Classification')
  })
  it('leaves a route empty when no kept statement belongs to it', () => {
    const f = parseRecord(record(['H225 (100%): Highly Flammable liquid and vapor [Danger Flammable liquids]']), '2026-11-17').fields
    expect(f.exp_eyes).toBeUndefined()
    expect(f.exp_ingestion).toBeUndefined()
  })
  it('ICSC symptoms win over GHS when both exist', () => {
    const icsc = { TOCHeading: 'Signs and Symptoms', Information: [{ Name: 'Eye Exposure', ReferenceNumber: 48, ...swm(['Redness. Pain.']) }] }
    expect(parseRecord(record(IODOFORM, [icsc]), '2026-11-17').fields.exp_eyes?.value).toBe('Redness. Pain.')
  })
})

describe('display clean-up', () => {
  it('vapour pressure: picks the value closest to 20 °C', () => {
    expect(vapourPressureForCard('40 mmHg at 41 °F ; 80.1 mmHg at 68 °F (NTP, 1992)'))
      .toEqual({ shown: '80.1 mmHg at 68 °F', converted: '80.1 mmHg at 20 °C', from: '68 °F' })
  })
  it('vapour pressure: ICSC "kPa at 20 °C: 2 - 2.5" becomes a mmHg range', () => {
    expect(vapourPressureForCard('Vapor pressure, kPa at 20 °C: 2 - 2.5'))
      .toEqual({ shown: '2 - 2.5 kPa at 20 °C', converted: '15 - 18.8 mmHg at 20 °C', from: '2 - 2.5 kPa' })
  })
  it('tidies source notes', () => {
    expect(tidy('1 [mm Hg] @745 °C')).toBe('1 mmHg at 745 °C')
    expect(tidy('8.94 (NIOSH, 2024) - Denser than water; will sink')).toBe('8.94')
    expect(temperatureForCard('Boiling point: 111 °C in solution').shown).toBe('111 °C in solution')
  })
  it('density: °F measuring temperature converted, number untouched', () => {
    expect(densityForCard('4.008 at 68 °F (NTP, 1992) - Denser than water; will sink'))
      .toEqual({ shown: '4.008 at 68 °F', converted: '4.008 at 20 °C', from: '68 °F' })
  })
})

describe('GHS shown when there is no NFPA rating', () => {
  const AGNO3 = [
    'H272 (97.4%): May intensify fire; oxidizer [Danger Oxidizing liquids; Oxidizing solids]',
    'H314 (99.9%): Causes severe skin burns and eye damage [Danger Skin corrosion/irritation]',
    'H360 (12%): May damage fertility or the unborn child [Danger Reproductive toxicity]',
  ]
  const r = parseRecord(record(AGNO3), '2026-11-17')
  const card = cardFromLookup({ ...r, cid: 24470 })
  it('stores the kept statements with the strongest signal word among them', () => {
    expect(r.fields.ghs?.value).toBe('Danger: H272: May intensify fire; oxidizer · H314: Causes severe skin burns and eye damage')
  })
  it('signal word comes only from kept statements', () => {
    const w = parseRecord(record(['H315 (90%): Causes skin irritation [Warning Skin corrosion/irritation]', 'H350 (5%): May cause cancer [Danger Carcinogenicity]']), '2026-11-17')
    expect(w.fields.ghs?.value).toBe('Warning: H315: Causes skin irritation')
  })
  it('merges the NFPA columns into one GHS cell, never NFPA numbers', () => {
    expect(ghsInsteadOfNfpa(card)).toMatch(/^GHS Danger: H272/)
    expect(cellsFor(card).fire).toBe('–')
    expect(toCsv([card]).split('\r\n')[1]).toContain('GHS Danger: H272')
  })
  it('a card WITH an NFPA rating keeps the NFPA columns', () => {
    const withNfpa = { ...card, fields: { ...card.fields, nfpa_health: { ...card.fields.ghs!, value: '3' } } }
    expect(ghsInsteadOfNfpa(withNfpa)).toBeUndefined()
  })
})
