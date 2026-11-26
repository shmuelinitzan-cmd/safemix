// The experiment table: same columns and order as the lab's form.
//   name | formula | MW | BP/MP | density | vapour pressure | waste container |
//   NFPA (fire, health, reactivity, special) | exposure (eyes, skin, inhalation, ingestion)
// One function builds the cell text, and the screen, the CSV and the PDF all use it.
import type { ChemicalCard, FieldKey } from '../types/card.ts'
import { FIELD_LABELS } from '../types/card.ts'
import { densityForCard, temperatureForCard, vapourPressureForCard, type CardValue } from './units.ts'
import { shortSource } from './sources.ts'
import { documentedReference, isNotVerified, NOT_VERIFIED } from './provenance.ts'

export const EMPTY_CELL = '–' // = "No data from approved sources"

export interface Column {
  id: string
  label: string
  group?: 'NFPA 704' | 'Exposure hazards'
  // NFPA colours for the header cells
  fill?: string
}

export const COLUMNS: Column[] = [
  { id: 'name', label: 'Chemical name' },
  { id: 'formula', label: 'Formula' },
  { id: 'mw', label: 'MW (g/mol)' },
  { id: 'bpmp', label: 'BP / MP (°C)' },
  { id: 'density', label: 'Density (g/mL)' },
  { id: 'vp', label: 'Vapour pressure (mmHg)' },
  { id: 'waste', label: 'Waste container' },
  { id: 'fire', label: 'Fire', group: 'NFPA 704', fill: '#dc2626' },
  { id: 'health', label: 'Health', group: 'NFPA 704', fill: '#2563eb' },
  { id: 'reactivity', label: 'Reactivity', group: 'NFPA 704', fill: '#facc15' },
  { id: 'special', label: 'Special', group: 'NFPA 704', fill: '#ffffff' },
  { id: 'eyes', label: 'Eyes', group: 'Exposure hazards' },
  { id: 'skin', label: 'Skin', group: 'Exposure hazards' },
  { id: 'inhalation', label: 'Inhalation', group: 'Exposure hazards' },
  { id: 'ingestion', label: 'Ingestion', group: 'Exposure hazards' },
]

export const FOOTNOTES = [
  `${EMPTY_CELL} = No data from approved sources.`,
  '† = Rule-based suggestion, confirm with lab instructions.',
  'converted from ... = shown in the table\'s units; the source\'s original value follows it and is on the sources page.',
  'GHS = no NFPA 704 rating in the approved sources; the GHS hazard statements are shown instead (not converted to NFPA numbers).',
  '(SDS) = typed in from the supplier SDS; the SDS is named on the sources page.',
  `${NOT_VERIFIED} = typed in by hand without a named SDS; not verified against an approved source.`,
]

// A value as shown in the table. Its condition is added when there is one, then a mark for
// values that did not come from a live source: "(Not verified)", "(SDS)" or the documented
// reference.
function plain(card: ChemicalCard, key: FieldKey, text = card.fields[key]?.value): string {
  const f = card.fields[key]
  if (!f || !text) return EMPTY_CELL
  const reference = documentedReference(card, key)
  const mark = isNotVerified(card, key) ? ` (${NOT_VERIFIED})` : f.source === 'sds' ? ' (SDS)' : reference ? ` (${reference})` : ''
  return text + (f.condition && !text.includes(f.condition) ? ` [applies to: ${f.condition}]` : '') + mark
}

// Converted values lead, in the table's units, followed by what the source said.
function withConverted(card: ChemicalCard, key: FieldKey, v: CardValue | undefined): string {
  if (!v?.shown) return EMPTY_CELL
  return plain(card, key, v.converted ? `${v.converted} (converted from ${v.from})` : v.shown)
}

function temperature(card: ChemicalCard, key: FieldKey): string {
  const f = card.fields[key]
  return f ? withConverted(card, key, temperatureForCard(f.value)) : EMPTY_CELL
}

// When a card has no NFPA rating at all but has GHS statements, the four NFPA columns are
// merged into one cell that shows the GHS statements. Returns that text, or undefined.
export function ghsInsteadOfNfpa(card: ChemicalCard): string | undefined {
  const f = card.fields
  if (f.nfpa_fire || f.nfpa_health || f.nfpa_reactivity || f.nfpa_special || !f.ghs) return undefined
  return `GHS ${plain(card, 'ghs')}`
}
export const NFPA_IDS = ['fire', 'health', 'reactivity', 'special']

export function cellsFor(card: ChemicalCard): Record<string, string> {
  const f = card.fields
  const g = (k: FieldKey) => plain(card, k)
  const vp = f.vapor_pressure && vapourPressureForCard(f.vapor_pressure.value)
  const waste = f.waste_container
  const rel = f.density?.quantity === 'relative_density' ? 'relative density ' : ''
  return {
    name: g('name') + (card.not_verified ? `\n${card.not_verified}` : ''),
    formula: g('formula'),
    mw: g('mw'),
    bpmp: `BP: ${temperature(card, 'bp')}\nMP: ${temperature(card, 'mp')}`,
    density: f.density ? withConverted(card, 'density', ((v) => ({ ...v, shown: rel + v.shown, converted: v.converted && rel + v.converted }))(densityForCard(f.density.value))) : EMPTY_CELL,
    vp: f.vapor_pressure && vp ? withConverted(card, 'vapor_pressure', vp) : EMPTY_CELL,
    waste: waste ? g('waste_container') + (waste.status === 'pending' && waste.origin === 'rule' ? ' †' : '') : EMPTY_CELL,
    fire: g('nfpa_fire'),
    health: g('nfpa_health'),
    reactivity: g('nfpa_reactivity'),
    special: g('nfpa_special'),
    eyes: g('exp_eyes'),
    skin: g('exp_skin'),
    inhalation: g('exp_inhalation'),
    ingestion: g('exp_ingestion'),
  }
}

// ---- CSV ---------------------------------------------------------------------------
const csvCell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

// Empty cells stay empty in the CSV (not "–"), so a spreadsheet sees a real blank.
export function toCsv(cards: ChemicalCard[]): string {
  const header = [...COLUMNS.map((c) => (c.group ? `${c.group}: ${c.label}` : c.label)), 'GHS hazards (when no NFPA rating)']
  const rows = cards.map((card) => {
    const cells = cellsFor(card)
    const ghs = ghsInsteadOfNfpa(card)
    return [...COLUMNS.map((c) => (cells[c.id] === EMPTY_CELL ? '' : cells[c.id].replace(/\n/g, '; '))), ghs ?? ''].map(csvCell)
  })
  // BOM so Excel reads the degree signs correctly.
  return '\ufeff' + [header.map(csvCell), ...rows].map((r) => r.join(',')).join('\r\n') + '\r\n'
}

// ---- Sources list (last pages of the PDF) -------------------------------------------
export interface SourceRow {
  chemical: string
  field: string
  value: string // the value as stored, in full
  source: string
  detail: string // citation or note
  retrieved: string
  url: string
}

const SOURCE_NAMES: Record<string, string> = { pubchem: 'PubChem', niosh: 'NIOSH', cameo: 'CAMEO', user: `${NOT_VERIFIED} (entered by hand)`, app: 'Rule in SafeMix', sds: 'Supplier SDS' }
const FIELD_ORDER: FieldKey[] = ['name', 'formula', 'mw', 'bp', 'mp', 'density', 'vapor_pressure', 'waste_container',
  'nfpa_fire', 'nfpa_health', 'nfpa_reactivity', 'nfpa_special', 'ghs', 'exp_eyes', 'exp_skin', 'exp_inhalation', 'exp_ingestion']

export function sourceRows(cards: ChemicalCard[]): SourceRow[] {
  const out: SourceRow[] = []
  for (const card of cards) {
    const chemical = `${card.fields.name?.value ?? 'Unnamed'}${card.cas ? ` (CAS ${card.cas.value})` : ''}`
    for (const k of FIELD_ORDER) {
      const f = card.fields[k]
      if (!f) continue
      const short = shortSource(f.upstream)
      const via = f.source === 'sds' ? `: ${f.upstream ?? 'not named'}`
        : f.upstream && f.upstream !== 'PubChem' && f.upstream !== 'PubChem record title'
        ? ` via ${short === f.upstream ? f.upstream : `${short} (${f.upstream})`}` : ''
      const detail = [
        f.upstream_citation,
        f.note,
        f.source_value ? `Source had: ${f.source_value}` : undefined,
        f.origin === 'rule' && f.status === 'pending' ? 'Rule-based suggestion, not yet confirmed.' : undefined,
      ].filter(Boolean).join(' ')
      const reference = documentedReference(card, k)
      const sourceName = reference ?? (isNotVerified(card, k) && f.source === 'sds' ? `${NOT_VERIFIED} (SDS not named)` : `${SOURCE_NAMES[f.source]}${via}`)
      out.push({
        chemical, field: FIELD_LABELS[k], value: f.value.replace(/\n/g, ' / '),
        // a hand-entered value gets no link: an older source's link would not back it
        source: sourceName, detail, retrieved: f.retrieved_at, url: f.source === 'user' ? '' : f.source_url,
      })
    }
  }
  return out
}
