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
// Text that is empty or only spaces counts as missing.
const text = (info: Json): string | undefined => {
  const s: string | undefined = info?.Value?.StringWithMarkup?.map((x: Json) => x.String).join('\n')
  return s?.trim() ? s : undefined
}

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
  const record = (await res.json())?.Record
  // Without its number and title there is nothing to make a card from.
  if (!record?.RecordNumber || !String(record.RecordTitle ?? '').trim()) throw new Error(`PubChem returned an empty or incomplete record for CID ${cid}.`)
  return record
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
  const valueOf = (i: Json): string | undefined => text(i) ?? (i.Value?.Number?.[0] !== undefined ? String(i.Value.Number[0]) : undefined)
  const info = findSection(record.Section, heading)?.Information?.find(valueOf) // the first entry that is not blank
  if (!info) return
  const v = valueOf(info)!
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

// NFPA 704. PubChem calls reactivity "Instability".
// A rating is a single whole number 0-4, alone or followed by " - explanation". The first such
// entry with that name is used. If none is one (e.g. "1.5" or "1-2"), the first entry is kept
// exactly as written and marked unverified: no number is ever cut out of it.
// The special-hazard entry is kept as its symbol only (e.g. "OX"), not the explanatory sentence.
const NFPA_RATING = /^([0-4])(?:\s+-\s+(?!(?:to|or|and)\b)[A-Za-z][\s\S]*)?$/
const NFPA_UNREAD_NOTE = 'Not a single whole number from 0 to 4. Shown as PubChem wrote it.'
function nfpa(record: Json, cid: number, name: string, date: string, digit: boolean): Field | undefined {
  const heading = 'NFPA Hazard Classification'
  const entries: { info: Json; raw: string }[] = (findSection(record.Section, heading)?.Information ?? [])
    .filter((info: Json) => info.Name === name && text(info))
    .map((info: Json) => ({ info, raw: text(info)!.trim() }))
  if (!entries.length) return
  if (!digit) {
    const symbol = entries[0].raw.split(/\s+-\s+/)[0].trim()
    return makeField(record, cid, heading, entries[0].info, symbol, date)
  }
  for (const { info, raw } of entries) {
    const rating = NFPA_RATING.exec(raw)?.[1]
    if (rating) return makeField(record, cid, heading, info, rating, date)
  }
  const f = makeField(record, cid, heading, entries[0].info, entries[0].raw, date)
  return { ...f, condition: undefined, unverified: true, note: NFPA_UNREAD_NOTE }
}

// ---- GHS hazard statements (fallback for the exposure columns) ----------------------
// Used ONLY for a route that has no ICSC "Signs and Symptoms" entry. Rule (fixed, documented):
//  1. Take the first "GHS Hazard Statements" entry whose reference is the European Chemicals
//     Agency (ECHA): the summary of the C&L notifications. If there is none, the first entry.
//  2. Keep the statements that at least half of the notifiers reported (the "(99.8%)" in the
//     text), or that carry no percentage. A code only a minority reported is dropped.
//  3. Sort each kept statement to a route by its H-code (table below). Codes for other effects
//     (e.g. aquatic toxicity, flammability) are not exposure routes and are not shown here.
//     A combined statement ("H302+H332") goes to the route of each of its codes.
//  The statement text is copied word for word, without the percentage and the bracketed class.
//  4. Nothing else is dropped silently. A line this rule cannot read (unknown form, or a share
//     such as "< 99%" that does not say whether half was reached) is kept exactly as written:
//     in the GHS summary, and in the route of every H-code it mentions.
export const GHS_ROUTES: Record<'exp_eyes' | 'exp_skin' | 'exp_inhalation' | 'exp_ingestion', string[]> = {
  exp_eyes: ['H314', 'H318', 'H319', 'H320'],
  exp_skin: ['H310', 'H311', 'H312', 'H314', 'H315', 'H316', 'H317'],
  exp_inhalation: ['H330', 'H331', 'H332', 'H334', 'H335', 'H336'],
  exp_ingestion: ['H300', 'H301', 'H302', 'H303', 'H304', 'H305'],
}
const GHS_MIN_SHARE = 50
const ECHA_NAME = 'European Chemicals Agency (ECHA)'
const sourceName = (record: Json, info: Json): string | undefined =>
  record.Reference?.find((r: Json) => r.ReferenceNumber === info.ReferenceNumber)?.SourceName

// Only the ECHA entry is a summary of notifications, so only its note mentions notifiers.
function ghsOrigin(record: Json, info: Json): string {
  const name = sourceName(record, info)
  return name === ECHA_NAME
    ? 'reported by at least half of the ECHA notifiers, or listed with no percentage'
    : `from ${name ?? 'a source PubChem does not name'}`
}

const H_CODE = 'H\\d{3}[A-Za-z]*'
const GHS_LINE = new RegExp(`^(${H_CODE}(?:\\s*\\+\\s*${H_CODE})*)(?:\\s*\\((>\\s*)?(\\d+(?:\\.\\d+)?)%\\))?:\\s*([^[]+?)\\s*(?:\\[(Danger|Warning)?|$)`)
const GHS_UNREAD_NOTE = ' Includes text SafeMix could not read, shown as PubChem wrote it (reporting share not checked).'

export interface GhsStatement {
  code: string // as written, e.g. "H319" or "H302+H332"
  codes: string[]
  text: string
  signal?: 'Danger' | 'Warning'
  unread?: boolean // the line could not be read; `text` is the whole line as written
}
function readGhsLine(line: string): GhsStatement | undefined {
  if (!line.trim()) return
  const asWritten = (): GhsStatement => {
    const codes = [...new Set<string>(line.match(new RegExp(H_CODE, 'g')) ?? [])]
    return { code: codes.join('+'), codes, text: line.trim(), unread: true }
  }
  const m = GHS_LINE.exec(line)
  if (!m) return asWritten()
  if (m[3] !== undefined && Number(m[3]) < GHS_MIN_SHARE) {
    return m[2] ? asWritten() : undefined // "> 40%" may or may not reach half
  }
  const codes = m[1].split('+').map((c) => c.trim())
  return { code: m[1], codes, text: `${m[1]}: ${m[4].trim()}`, signal: m[5] as GhsStatement['signal'] }
}

export function ghsStatements(record: Json): { info: Json; statements: GhsStatement[] } | undefined {
  const infos: Json[] = (findSection(record.Section, 'GHS Classification')?.Information ?? []).filter((i: Json) => i.Name === 'GHS Hazard Statements')
  if (!infos.length) return
  const isEcha = (i: Json) => sourceName(record, i) === ECHA_NAME
  const info = infos.find(isEcha) ?? infos[0]
  const lines: string[] = info.Value?.StringWithMarkup?.map((x: Json) => x.String as string) ?? []
  const statements = lines.map(readGhsLine).filter((s): s is GhsStatement => !!s)
  return { info, statements }
}

function ghsRoute(record: Json, cid: number, key: keyof typeof GHS_ROUTES, date: string): Field | undefined {
  const g = ghsStatements(record)
  if (!g) return
  const hits = g.statements.filter((s) => s.codes.some((c) => GHS_ROUTES[key].includes(c)))
  if (!hits.length) return
  const f = makeField(record, cid, 'GHS Classification', g.info, [...new Set(hits.map((h) => h.text))].join('; '), date)
  f.condition = undefined
  f.note = `GHS hazard statements ${ghsOrigin(record, g.info)} (no ICSC symptoms for this route in PubChem).${hits.some((h) => h.unread) ? GHS_UNREAD_NOTE : ''}`
  return f
}

// All kept GHS statements in one value, for the NFPA columns when there is no NFPA rating.
// The signal word is the strongest one among the KEPT statements ("Danger" over "Warning"),
// not PubChem's overall "Signal" line, which also counts minority notifications.
// GHS is never turned into NFPA numbers: the two systems rate hazards differently.
function ghsSummary(record: Json, cid: number, date: string): Field | undefined {
  const g = ghsStatements(record)
  if (!g?.statements.length) return
  const signal = g.statements.some((s) => s.signal === 'Danger') ? 'Danger' : g.statements.some((s) => s.signal === 'Warning') ? 'Warning' : undefined
  const list = [...new Set(g.statements.map((s) => s.text))].join(' · ')
  const f = makeField(record, cid, 'GHS Classification', g.info, signal ? `${signal}: ${list}` : list, date)
  f.condition = undefined
  f.note = `GHS hazard statements ${ghsOrigin(record, g.info)}.${g.statements.some((s) => s.unread) ? GHS_UNREAD_NOTE : ''}`
  return f
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
    ghs: ghsSummary(record, cid, date),
    exp_eyes: symptoms(record, cid, 'Eye Exposure', date) ?? ghsRoute(record, cid, 'exp_eyes', date),
    exp_skin: symptoms(record, cid, 'Skin Exposure', date) ?? ghsRoute(record, cid, 'exp_skin', date),
    exp_inhalation: symptoms(record, cid, 'Inhalation Exposure', date) ?? ghsRoute(record, cid, 'exp_inhalation', date),
    exp_ingestion: symptoms(record, cid, 'Ingestion Exposure', date) ?? ghsRoute(record, cid, 'exp_ingestion', date),
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
