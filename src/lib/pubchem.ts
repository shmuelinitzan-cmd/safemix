// Reads PubChem's PUG REST / PUG View answers into the lab-table card fields.
// The app only ever copies text that PubChem returned. Nothing is invented here.
import type { Field, FieldKey } from '../types/card.ts'
import { FIELD_KEYS } from '../types/card.ts'
import { suggestWaste, WASTE_OVERRIDES } from './waste.ts'

const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
const PUG_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any

function findSection(sections: Json[] | undefined, heading: string): Json | undefined {
  for (const s of sections ?? []) {
    if (s.TOCHeading === heading) return s
    const hit = findSection(s.Section, heading)
    if (hit) return hit
  }
}

const anchor = (heading: string) => heading.replace(/[^A-Za-z0-9]+/g, '-')
const text = (info: Json): string | undefined =>
  info?.Value?.StringWithMarkup?.map((x: Json) => x.String).join('\n')

export async function fetchCid(nameOrCas: string): Promise<number> {
  const res = await fetch(`${PUG}/compound/name/${encodeURIComponent(nameOrCas.trim())}/cids/JSON`)
  if (!res.ok) throw new Error(`PubChem could not find "${nameOrCas}" (HTTP ${res.status}).`)
  const cid = (await res.json())?.IdentifierList?.CID?.[0]
  if (!cid) throw new Error(`PubChem returned no compound for "${nameOrCas}".`)
  return cid
}

export async function fetchRecord(cid: number): Promise<Json> {
  const res = await fetch(`${PUG_VIEW}/data/compound/${cid}/JSON`)
  if (!res.ok) throw new Error(`PubChem record ${cid} failed (HTTP ${res.status}).`)
  return (await res.json()).Record
}

// A condition is a percentage phrase copied word for word from the value text, e.g.
// "10.17% weight/weight solution" or "more than 60%". A number that IS the value (text
// starts with it, like "111 %") is not a condition. No match -> no condition.
const CONDITION_RE =
  /(?:(?:more|greater|less) than\s+|>\/?=?\s*|<\/?=?\s*)?\d+(?:\.\d+)?\s?%(?:\s+to\s+[<>]?\/?=?\s*\d+(?:\.\d+)?\s?%)?(?:\s+(?:weight\/weight|w\/w|by weight))?(?:\s+(?:aqueous\s+)?(?:hydrogen peroxide|sodium hydroxide|acetic acid)?\s*solutions?)?/i

export function extractCondition(value: string): string | undefined {
  const m = CONDITION_RE.exec(value)
  if (!m || m.index === 0) return undefined
  return m[0].trim()
}

function makeField(record: Json, cid: number, heading: string, info: Json, value: string, date: string): Field {
  const ref = record.Reference?.find((r: Json) => r.ReferenceNumber === info.ReferenceNumber)
  return {
    value,
    source: 'pubchem',
    source_url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}#section=${anchor(heading)}`,
    retrieved_at: date,
    origin: 'source',
    status: 'pending',
    upstream: ref?.SourceName,
    upstream_citation: info.Reference?.join(' '),
    condition: extractCondition(value),
  }
}

// VALUE RULE (fixed, documented):
//  1. For BP, MP and density, scan ALL values PubChem lists (any source) and take the FIRST
//     one already in the card's unit (°C; g/mL, g/cm³).
//  2. If none is in the card's unit, take the first listed value as given. Temperatures and
//     pressures then get a labelled "converted" hint in the UI (never stored).
//  3. Density: if the value is a bare number relative to water (specific gravity), it is
//     tagged quantity = "relative_density" and shown with no unit.
//  Other fields (e.g. vapour pressure) always take the first listed value.
const QUAL = '(?:(?:greater|less|more) than\\s+|>=?\\s*|<=?\\s*|about\\s+|approx\\.?\\s+)?'
export const IN_CELSIUS = new RegExp(`^\\s*${QUAL}-?\\d+(?:\\.\\d+)?\\s*°\\s?C\\b`, 'i')
export const IN_G_PER_ML = new RegExp(`^\\s*${QUAL}\\d+(?:\\.\\d+)?\\s*g\\s?/\\s?(?:mL|cm³|cm3|cu\\.? cm|cc)(?![\\w])`, 'i')
// A bare leading number (optionally after "Relative density (water = 1):") has no unit.
export const BARE_RELATIVE = /^\s*(?:relative density[^:]*:\s*)?(?:(?:greater|less|more) than\s+|>=?\s*|<=?\s*)?\d+(?:\.\d+)?(?![\d.])(?!\s*(?!at\b)[a-zA-Z°%/])/i

function pickValue(record: Json, cid: number, heading: string, date: string, inUnit?: RegExp): Field | undefined {
  const infos: Json[] = findSection(record.Section, heading)?.Information ?? []
  const texts = infos.map((info) => ({ info, v: text(info)?.trim() })).filter((x): x is { info: Json; v: string } => !!x.v)
  const hit = (inUnit && texts.find((x) => inUnit.test(x.v))) || texts[0]
  return hit && makeField(record, cid, heading, hit.info, hit.v, date)
}

function firstText(record: Json, cid: number, heading: string, date: string): Field | undefined {
  return pickValue(record, cid, heading, date)
}

function density(record: Json, cid: number, date: string): Field | undefined {
  const f = pickValue(record, cid, 'Density', date, IN_G_PER_ML)
  if (f && !IN_G_PER_ML.test(f.value) && BARE_RELATIVE.test(f.value)) f.quantity = 'relative_density'
  return f
}

function molecularWeight(record: Json, cid: number, date: string): Field | undefined {
  const heading = 'Molecular Weight'
  const info = findSection(record.Section, heading)?.Information?.[0]
  const v = info && (text(info) ?? (info.Value?.Number?.[0] !== undefined ? String(info.Value.Number[0]) : undefined))
  if (!v) return
  const f = makeField(record, cid, heading, info, v, date)
  f.unit = info.Value?.Unit ?? 'g/mol'
  return f
}

// ICSC "Signs and Symptoms" entries are named "Eye Exposure", "Skin Exposure", ...
function symptoms(record: Json, cid: number, name: string, date: string): Field | undefined {
  const heading = 'Signs and Symptoms'
  for (const info of findSection(record.Section, heading)?.Information ?? [])
    if (info.Name === name) {
      const v = text(info)
      if (v) return makeField(record, cid, heading, info, v.trim(), date)
    }
}

// NFPA 704: first PubChem entry with that name. PubChem calls reactivity "Instability".
// The special-hazard entry is kept as its symbol only (e.g. "OX"), not the explanatory sentence.
function nfpa(record: Json, cid: number, name: string, date: string, digit: boolean): Field | undefined {
  const heading = 'NFPA Hazard Classification'
  for (const info of findSection(record.Section, heading)?.Information ?? [])
    if (info.Name === name) {
      const raw = text(info)?.trim()
      const v = digit ? /^([0-4])\b/.exec(raw ?? '')?.[1] : raw?.split(/\s+-\s+/)[0].trim()
      if (v) return makeField(record, cid, heading, info, v, date)
    }
}

export interface PubChemResult {
  cid: number
  title: string
  cas?: Field
  fields: Partial<Record<FieldKey, Field>>
  missing: FieldKey[]
  waste_reason?: string
}

export function parseRecord(record: Json, date: string): PubChemResult {
  const cid: number = record.RecordNumber
  const f: Partial<Record<FieldKey, Field | undefined>> = {
    name: {
      value: record.RecordTitle, source: 'pubchem', retrieved_at: date, origin: 'source', status: 'pending',
      source_url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`, upstream: 'PubChem record title',
    },
    formula: firstText(record, cid, 'Molecular Formula', date),
    mw: molecularWeight(record, cid, date),
    bp: pickValue(record, cid, 'Boiling Point', date, IN_CELSIUS),
    mp: pickValue(record, cid, 'Melting Point', date, IN_CELSIUS),
    density: density(record, cid, date),
    vapor_pressure: firstText(record, cid, 'Vapor Pressure', date),
    nfpa_fire: nfpa(record, cid, 'NFPA Fire Rating', date, true),
    nfpa_health: nfpa(record, cid, 'NFPA Health Rating', date, true),
    nfpa_reactivity: nfpa(record, cid, 'NFPA Instability Rating', date, true),
    nfpa_special: nfpa(record, cid, 'NFPA Specific Notice', date, false),
    exp_eyes: symptoms(record, cid, 'Eye Exposure', date),
    exp_skin: symptoms(record, cid, 'Skin Exposure', date),
    exp_inhalation: symptoms(record, cid, 'Inhalation Exposure', date),
    exp_ingestion: symptoms(record, cid, 'Ingestion Exposure', date),
  }

  // Waste container: rule-based suggestion from the formula, never from PubChem text.
  let waste_reason: string | undefined
  if (f.formula) {
    const s = suggestWaste(f.formula.value)
    waste_reason = s.reason
    f.waste_container = {
      value: s.category, source: 'app', retrieved_at: date, origin: 'rule', status: 'pending',
      source_url: 'https://github.com/shmuelinitzan-cmd/safemix/blob/main/src/lib/waste.ts',
    }
  }

  const casInfo = findSection(record.Section, 'CAS')?.Information?.[0]
  const casVal = text(casInfo)
  const cas = casVal ? makeField(record, cid, 'CAS', casInfo, casVal, date) : undefined

  // Manual override per chemical (by CAS): replaces the rule's suggestion, marked as user-set.
  const override = cas ? WASTE_OVERRIDES[cas.value] : undefined
  if (override)
    f.waste_container = {
      value: override, source: 'user', retrieved_at: date, origin: 'user', status: 'pending',
      source_url: 'https://github.com/shmuelinitzan-cmd/safemix/blob/main/src/lib/waste.ts',
    }

  const fields: PubChemResult['fields'] = {}
  for (const k of FIELD_KEYS) if (f[k]) fields[k] = f[k]
  return { cid, title: record.RecordTitle, cas, fields, missing: FIELD_KEYS.filter((k) => !fields[k]), waste_reason }
}

export async function lookup(nameOrCas: string, date = new Date().toISOString().slice(0, 10)): Promise<PubChemResult> {
  return parseRecord(await fetchRecord(await fetchCid(nameOrCas)), date)
}
