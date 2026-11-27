// Stage 2, part C2: reading a PubChem record. Extends lib.test.ts and ghs.test.ts.
// All records are fake (title "T", CID 1, placeholder values), not chemical data.
//
// `it.fails` = the correct behaviour the app does not have yet (see units.test.ts).
import { describe, expect, it } from 'vitest'
import { FIELD_KEYS, type FieldKey } from '../types/card.ts'
import { extractCondition, ghsStatements, parseRecord } from './pubchem.ts'
import { cardFromLookup } from './cards.ts'

const swm = (...lines: string[]) => ({ ReferenceNumber: 1, Value: { StringWithMarkup: lines.map((String) => ({ String })) } })
const named = (Name: string, ...lines: string[]) => ({ Name, ...swm(...lines) })
const section = (TOCHeading: string, ...Information: object[]) => ({ TOCHeading, Information })
const record = (...Section: object[]) => ({
  RecordNumber: 1, RecordTitle: 'T', Reference: [{ ReferenceNumber: 1, SourceName: 'Fake Source (FS)' }], Section,
})
const parse = (...sections: object[]) => parseRecord(record(...sections), '2026-01-01')
const ghs = (...lines: string[]) => section('GHS Classification', named('GHS Hazard Statements', ...lines))
const statement = (code: string, share = ' (100%)') => `${code}${share}: fake ${code} [Warning Fake class]`

describe('every field comes from its own heading', () => {
  // Nested three levels deep, like PUG View, with a decoy heading that must be ignored.
  const nested = { TOCHeading: 'Outer', Section: [{ TOCHeading: 'Middle', Section: [
    section('Decoy Heading', swm('decoy')),
    section('Molecular Formula', swm('C2H4')),
    section('Molecular Weight', swm('101')),
    section('Boiling Point', swm('102 °C')),
    section('Melting Point', swm('103 °C')),
    section('Density', swm('104 g/mL')),
    section('Vapor Pressure', swm('105 mmHg')),
    section('NFPA Hazard Classification',
      named('NFPA Fire Rating', '1'), named('NFPA Health Rating', '2'),
      named('NFPA Instability Rating', '3'), named('NFPA Specific Notice', 'XX - fake notice')),
    section('Signs and Symptoms',
      named('Eye Exposure', 'fake eyes'), named('Skin Exposure', 'fake skin'),
      named('Inhalation Exposure', 'fake inhalation'), named('Ingestion Exposure', 'fake ingestion')),
    ghs(statement('H319')),
    section('CAS', swm('0-00-0')),
  ] }] }
  const r = parse(nested)

  it.each<[FieldKey, string]>([
    ['name', 'T'], ['formula', 'C2H4'], ['mw', '101'], ['bp', '102 °C'], ['mp', '103 °C'], ['density', '104 g/mL'],
    ['vapor_pressure', '105 mmHg'], ['waste_container', 'organic'],
    ['nfpa_fire', '1'], ['nfpa_health', '2'], ['nfpa_reactivity', '3'], ['nfpa_special', 'XX'],
    ['ghs', 'Warning: H319: fake H319'],
    ['exp_eyes', 'fake eyes'], ['exp_skin', 'fake skin'], ['exp_inhalation', 'fake inhalation'], ['exp_ingestion', 'fake ingestion'],
  ])('%s', (key, value) => expect(r.fields[key]?.value).toBe(value))

  it('nothing is missing, and CAS is read', () => {
    expect(r.missing).toEqual([])
    expect(r.cas?.value).toBe('0-00-0')
  })

  it('every value has a source, https link, date and pending status', () => {
    for (const f of [...Object.values(r.fields), r.cas!]) {
      expect(f).toMatchObject({ status: 'pending', retrieved_at: '2026-01-01' })
      expect(f.source_url).toMatch(/^https:\/\//)
    }
    for (const k of FIELD_KEYS.filter((k) => k !== 'waste_container')) {
      expect(r.fields[k]).toMatchObject({ source: 'pubchem', origin: 'source' })
      expect(r.fields[k]!.source_url).toMatch(/^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/compound\/1/)
    }
  })

  it('the waste suggestion is marked as the app rule, not PubChem data', () => {
    expect(r.fields.waste_container).toMatchObject({ source: 'app', origin: 'rule' })
  })
})

describe('a record with a number and title but no data', () => {
  const r = parse()
  it('gives only the name: no other value and no waste suggestion', () => {
    expect(Object.keys(r.fields)).toEqual(['name'])
    expect(r.missing).toEqual(FIELD_KEYS.filter((k) => k !== 'name'))
    expect(r.waste_reason).toBeUndefined()
    expect(r.cas).toBeUndefined()
  })
})

describe('NFPA ratings', () => {
  const fire = (...values: string[]) =>
    parse(section('NFPA Hazard Classification', ...values.map((v) => named('NFPA Fire Rating', v)))).fields.nfpa_fire?.value

  it.each(['0', '1', '2', '3', '4'])('accepts %s', (v) => expect(fire(v)).toBe(v))
  it.each(['2 - fake explanation', '2 - Fake text, below 100 or 1-2 units', ' 2 - Fake text.\nSecond line'])(
    'keeps only the digit when an explanation follows: "%s"', (v) => expect(fire(v)).toBe('2'))
  const unread = ['5', '10', '-1', 'OX', 'rating 2', '1.5', '1-2', '1 - 2', '2 - or 3', '1 - to 2', '3 or 4', '2 -', '1, 2']
  it.each(unread)('"%s" is kept as written and marked unverified: no number is cut out of it', (v) => {
    const f = parse(section('NFPA Hazard Classification', named('NFPA Fire Rating', v))).fields.nfpa_fire
    expect(f).toMatchObject({ value: v, unverified: true, note: 'Not a single whole number from 0 to 4. Shown as PubChem wrote it.' })
  })
  it.each(['', '   '])('a blank entry "%s" is missing', (v) => expect(fire(v)).toBeUndefined())
  it('a later entry with a real rating is used', () => expect(fire('fake', '3')).toBe('3'))
  it('a real rating is not marked unverified', () => {
    expect(parse(section('NFPA Hazard Classification', named('NFPA Fire Rating', '3'))).fields.nfpa_fire?.unverified).toBeUndefined()
  })

  const special = (v: string) => parse(section('NFPA Hazard Classification', named('NFPA Specific Notice', v))).fields.nfpa_special?.value
  it('the special notice keeps only the symbol', () => expect(special('XX - fake explanation - more')).toBe('XX'))
  it('a symbol with a hyphen inside stays whole', () => expect(special('X-X')).toBe('X-X'))
})

describe('exposure: ICSC symptoms first, then GHS, route by route', () => {
  const r = parse(
    section('Signs and Symptoms', named('Eye Exposure', 'fake eyes')),
    ghs(statement('H319'), statement('H315'), statement('H332')),
  )
  it('uses ICSC where there is an entry', () => expect(r.fields.exp_eyes?.value).toBe('fake eyes'))
  it('uses GHS for the other routes', () => {
    expect(r.fields.exp_skin?.value).toBe('H315: fake H315')
    expect(r.fields.exp_inhalation?.value).toBe('H332: fake H332')
  })
  it('leaves a route empty when neither has it', () => {
    expect(r.fields.exp_ingestion).toBeUndefined()
    expect(r.missing).toContain('exp_ingestion')
  })
  it('a symptom entry that is only spaces counts as missing, so GHS is used', () => {
    const blank = parse(section('Signs and Symptoms', named('Eye Exposure', '   ')), ghs(statement('H319')))
    expect(blank.fields.exp_eyes?.value).toBe('H319: fake H319')
  })
})

describe('GHS: which statements are kept', () => {
  const codes = (...lines: string[]) => ghsStatements(record(ghs(...lines)))?.statements.map((s) => s.code)
  it.each<[string, boolean]>([
    [' (49.9%)', false], [' (50%)', true], [' (50.0%)', true], [' (100%)', true],
    ['', true], [' (> 99.9%)', true], [' (>99.9%)', true], [' (> 50%)', true],
  ])('share "%s" kept: %s', (share, kept) => expect(codes(statement('H319', share))).toEqual(kept ? ['H319'] : []))

  it('keeps a statement that has no class in brackets', () => expect(codes('H319 (100%): fake text')).toEqual(['H319']))
  it('ignores blank lines', () => expect(codes('', '   ')).toEqual([]))
  it('lists a repeated statement once', () => {
    expect(parse(ghs(statement('H319'), statement('H319'))).fields.exp_eyes?.value).toBe('H319: fake H319')
  })
})

describe('GHS: no hazard is dropped silently', () => {
  const routes = ['exp_eyes', 'exp_skin', 'exp_inhalation', 'exp_ingestion'] as const

  it('a combined statement goes to the route of each of its codes', () => {
    const f = parse(ghs('H302+H312+H332 (100%): fake combined [Warning Fake]')).fields
    for (const k of ['exp_skin', 'exp_inhalation', 'exp_ingestion'] as const) expect(f[k]?.value).toBe('H302+H312+H332: fake combined')
    expect(f.exp_eyes).toBeUndefined()
    expect(f.ghs?.value).toBe('Warning: H302+H312+H332: fake combined')
    expect(f.ghs?.note).not.toContain('could not read')
  })
  it('a combined statement written with spaces is read too', () => {
    expect(parse(ghs('H315 + H319: fake combined')).fields.exp_eyes?.value).toBe('H315 + H319: fake combined')
  })
  it('a combined statement under half is left out, like any other', () => {
    expect(parse(ghs('H302+H332 (20%): fake [Warning Fake]')).fields.ghs).toBeUndefined()
  })
  it('a code with letters after the number is kept', () => {
    expect(parse(ghs('H360FD (100%): fake [Danger Fake]')).fields.ghs?.value).toBe('Danger: H360FD: fake')
  })
  it.each(['H319 (< 99%): fake [Warning Fake]', 'H319 (> 40%): fake [Warning Fake]', 'H319 fake without a colon', 'H319 (about half): fake'])(
    'an unreadable line is shown as written, in the summary and its route: "%s"', (line) => {
      const f = parse(ghs(line)).fields
      expect(f.ghs?.value).toBe(line)
      expect(f.exp_eyes?.value).toBe(line)
      for (const k of ['ghs', 'exp_eyes'] as const) expect(f[k]?.note).toContain('could not read')
    })
  it('an unreadable line with two codes goes to both routes', () => {
    const line = 'H302 and H319 fake'
    const f = parse(ghs(line)).fields
    expect([f.exp_eyes?.value, f.exp_ingestion?.value]).toEqual([line, line])
  })
  it('a line without any code is shown in the summary only', () => {
    const f = parse(ghs('Fake unreadable line')).fields
    expect(f.ghs?.value).toBe('Fake unreadable line')
    for (const k of routes) expect(f[k]).toBeUndefined()
  })
  it('the signal word comes only from statements that were read', () => {
    expect(parse(ghs(statement('H315'), 'H319 (< 99%): fake [Danger Fake]')).fields.ghs?.value)
      .toBe('Warning: H315: fake H315 · H319 (< 99%): fake [Danger Fake]')
  })
})

describe('CAS number', () => {
  it('when present, it is the card id', () => {
    expect(cardFromLookup(parse(section('CAS', swm('0-00-0')))).id).toBe('cas-0-00-0')
  })
  it('when absent, the card id uses the CID', () => expect(cardFromLookup(parse()).id).toBe('cid-1'))
  it('a CAS entry that is only spaces counts as absent', () => {
    expect(parse(section('CAS', swm('   '))).cas).toBeUndefined()
  })
})

describe('multi-line values and conditions', () => {
  it('keeps all lines of one entry', () => {
    expect(parse(section('Vapor Pressure', swm('line one', 'line two'))).fields.vapor_pressure?.value).toBe('line one\nline two')
  })
  it('trims outer spaces and skips a blank first entry', () => {
    expect(parse(section('Vapor Pressure', swm('   '), swm('  105 mmHg  '))).fields.vapor_pressure?.value).toBe('105 mmHg')
  })
  it.each<[string, string]>([
    ['fake value (more than 10%)', 'more than 10%'],
    ['fake value, 10.5% weight/weight solution', '10.5% weight/weight solution'],
    ['fake value for 10% aqueous solution', '10% aqueous solution'],
    ['fake value >= 10% to <20%', '>= 10% to <20%'],
  ])('finds the condition in "%s", copied word for word', (value, condition) => {
    expect(extractCondition(value)).toBe(condition)
    expect(value).toContain(condition)
  })
  it('the condition is stored on the field', () => {
    expect(parse(section('Boiling Point', swm('102 °C (10% solution)'))).fields.bp?.condition).toBe('10% solution')
  })
})
