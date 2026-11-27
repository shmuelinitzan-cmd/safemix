// Stage 3, part C3: the parser on real PubChem records. The JSON files in __fixtures__/ are
// downloaded PUG View answers, trimmed to the sections the parser reads: whole sections were
// removed and no remaining text was changed. Each has a .source.txt with CID, URL, retrieval
// date, and the checksums of the original and the trimmed file. Never edit them or write one
// by hand. (If the parser starts reading another section, download the records again.)
//
// The checks below read the raw record on their own (not through the parser): every value that
// says it came from PubChem must be found there, under the right heading.
import { describe, expect, it } from 'vitest'
import { parseRecord } from './pubchem.ts'
import type { Field, FieldKey } from '../types/card.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */
const raw = import.meta.glob<string>('./__fixtures__/*.json', { query: '?raw', import: 'default', eager: true })
const notes = import.meta.glob<string>('./__fixtures__/*.source.txt', { query: '?raw', import: 'default', eager: true })
const NAMES = ['acetone', 'ethanol', 'acetic-acid', 'sodium-hydroxide', 'hydrogen-peroxide', 'iodoform']

const HEADINGS: Partial<Record<FieldKey | 'cas', string>> = {
  formula: 'Molecular Formula', mw: 'Molecular Weight', bp: 'Boiling Point', mp: 'Melting Point',
  density: 'Density', vapor_pressure: 'Vapor Pressure', cas: 'CAS',
}
const SYMPTOMS: Partial<Record<FieldKey, string>> = {
  exp_eyes: 'Eye Exposure', exp_skin: 'Skin Exposure', exp_inhalation: 'Inhalation Exposure', exp_ingestion: 'Ingestion Exposure',
}
const NFPA: Partial<Record<FieldKey, string>> = {
  nfpa_fire: 'NFPA Fire Rating', nfpa_health: 'NFPA Health Rating', nfpa_reactivity: 'NFPA Instability Rating', nfpa_special: 'NFPA Specific Notice',
}

function sections(list: any[] | undefined, heading: string, out: any[] = []) {
  for (const s of list ?? []) {
    if (s.TOCHeading === heading) out.push(s)
    sections(s.Section, heading, out)
  }
  return out
}
const entries = (record: any, heading: string): any[] => sections(record.Section, heading).flatMap((s) => s.Information ?? [])
const lines = (info: any): string[] => info.Value?.StringWithMarkup?.map((x: any) => x.String) ?? []
const entryText = (info: any) => lines(info).join('\n') || String(info.Value?.Number?.[0] ?? '')
const sourceOf = (record: any, info: any) => record.Reference.find((r: any) => r.ReferenceNumber === info.ReferenceNumber)?.SourceName

// The raw entries that back a value. Allowed changes: outer spaces trimmed, an NFPA entry
// shortened to its rating or symbol, and GHS lines filtered and shortened.
function backing(record: any, key: FieldKey | 'cas', field: Field): any[] {
  if (NFPA[key as FieldKey]) {
    return entries(record, 'NFPA Hazard Classification').filter((i) => {
      const t = entryText(i).trim()
      return i.Name === NFPA[key as FieldKey] && (t === field.value || t.startsWith(`${field.value} - `))
    })
  }
  if (field.note?.startsWith('GHS hazard statements')) {
    const parts = field.value.replace(/^(Danger|Warning): /, '').split(/(?: · |; )(?=H\d{3})/)
    return entries(record, 'GHS Classification').filter((i) => i.Name === 'GHS Hazard Statements' && parts.every((part) => {
      const [, code, statement] = /^([^:]+): (.+)$/.exec(part)!
      return lines(i).some((line) => {
        const share = /\((?:>\s*)?(\d+(?:\.\d+)?)%\)/.exec(line)?.[1]
        return line.startsWith(code) && line.includes(`: ${statement}`) && (share === undefined || Number(share) >= 50)
      })
    }))
  }
  if (SYMPTOMS[key as FieldKey]) {
    return entries(record, 'Signs and Symptoms').filter((i) => i.Name === SYMPTOMS[key as FieldKey] && entryText(i).trim() === field.value)
  }
  return entries(record, HEADINGS[key]!).filter((i) => entryText(i) === field.value || entryText(i).trim() === field.value)
}

it('there is a fixture and a source note for each of the 6 records', () => {
  expect(Object.keys(raw).sort()).toEqual(NAMES.map((n) => `./__fixtures__/${n}.json`).sort())
  expect(Object.keys(notes)).toHaveLength(6)
})

describe.each(NAMES)('%s (real PubChem record)', (name) => {
  const json = raw[`./__fixtures__/${name}.json`]
  const note = notes[`./__fixtures__/${name}.source.txt`]
  const info = Object.fromEntries(note.trim().split('\n').map((l) => l.split(/: (.*)/s).slice(0, 2)))
  const record = JSON.parse(json).Record
  const result = parseRecord(record, '2026-01-01')
  const fromPubChem = [...Object.entries(result.fields), ['cas', result.cas!] as const]
    .filter(([key, f]) => f!.source === 'pubchem' && key !== 'name') as [FieldKey | 'cas', Field][]

  it('is unchanged since it was trimmed (checksum), and its note matches', async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))
    expect([...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')).toBe(info['Trimmed-SHA-256'])
    expect(info['Original-SHA-256']).toMatch(/^[0-9a-f]{64}$/)
    expect(info['Original-SHA-256']).not.toBe(info['Trimmed-SHA-256'])
    expect(info.URL).toBe(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${info.CID}/JSON`)
    expect(String(record.RecordNumber)).toBe(info.CID)
    expect(info.Retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('has only the sections listed in its note, and the sections that contain them', () => {
    const kept = /Kept: (.*) \(and the sections that contain them\)/.exec(info.Trimmed)![1].split('; ')
    const extra: string[] = []
    const check = (list: any[] = []): boolean => list.map((s) => {
      if (kept.includes(s.TOCHeading)) return true
      const wraps = check(s.Section)
      if (!wraps) extra.push(s.TOCHeading)
      return wraps
    }).some(Boolean)
    check(record.Section)
    expect(extra).toEqual([])
  })

  it('the name is the record title', () => expect(result.fields.name?.value).toBe(record.RecordTitle))

  it('every PubChem value is in the raw record, with the source name PubChem gives it', () => {
    expect(fromPubChem.length).toBeGreaterThan(5)
    for (const [key, field] of fromPubChem) {
      const found = backing(record, key, field)
      expect(found.length, `${key}: "${field.value}" not found in the record`).toBeGreaterThan(0)
      expect(found.map((i) => sourceOf(record, i)), key).toContain(field.upstream)
      if (field.condition) expect(field.value).toContain(field.condition)
    }
  })

  it('the only value that is not from PubChem is the waste suggestion', () => {
    const others = Object.entries(result.fields).filter(([, f]) => f!.source !== 'pubchem').map(([k]) => k)
    expect(others).toEqual(['waste_container'])
  })

  // A recorded copy of the parser's output. If it changes, check each change against the raw
  // record before accepting it with `npx vitest run -u`.
  it('parses to the recorded output', () => expect(result).toMatchSnapshot())
})
