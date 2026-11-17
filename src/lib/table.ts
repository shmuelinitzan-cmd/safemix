// The experiment table: same columns and order as the lab's form.
//   name | formula | MW | BP/MP | density | vapour pressure | waste container |
//   NFPA (fire, health, reactivity, special) | exposure (eyes, skin, inhalation, ingestion)
// One function builds the cell text, and the screen, the CSV and the PDF all use it.
import type { ChemicalCard, Field, FieldKey } from '../types/card.ts'
import { FIELD_LABELS } from '../types/card.ts'
import { densityForCard, temperatureForCard, vapourPressureForCard, type CardValue } from './units.ts'
import { shortSource } from './sources.ts'

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
  '(SDS) = typed in from the supplier SDS; the SDS is named on the sources page.',
  '(edited) = value changed by hand; see the sources page.',
]

// A value as shown in the table: condition and "(edited)" are added when they apply.
// The chemical name never gets "(edited)": a renamed chemical is not changed safety data,
// and the change is still listed on the sources page.
function plain(f: Field | undefined, text = f?.value, markEdited = true): string {
  if (!f || !text) return EMPTY_CELL
  const mark = !markEdited || f.origin !== 'user' ? '' : f.source === 'sds' ? ' (SDS)' : ' (edited)'
  return text + (f.condition && !text.includes(f.condition) ? ` [applies to: ${f.condition}]` : '') + mark
}

// Converted values lead, in the table's units, followed by what the source said.
function withConverted(f: Field | undefined, v: CardValue | undefined): string {
  if (!f || !v?.shown) return EMPTY_CELL
  return plain(f, v.converted ? `${v.converted} (converted from ${v.from})` : v.shown)
}

function temperature(f: Field | undefined): string {
  return f ? withConverted(f, temperatureForCard(f.value)) : EMPTY_CELL
}

export function cellsFor(card: ChemicalCard): Record<string, string> {
  const f = card.fields
  const g = (k: FieldKey) => f[k]
  const vp = f.vapor_pressure && vapourPressureForCard(f.vapor_pressure.value)
  const waste = f.waste_container
  const rel = f.density?.quantity === 'relative_density' ? 'relative density ' : ''
  return {
    name: plain(g('name'), undefined, false),
    formula: plain(g('formula')),
    mw: plain(g('mw')),
    bpmp: `BP: ${temperature(g('bp'))}\nMP: ${temperature(g('mp'))}`,
    density: f.density ? withConverted(f.density, ((v) => ({ ...v, shown: rel + v.shown, converted: v.converted && rel + v.converted }))(densityForCard(f.density.value))) : EMPTY_CELL,
    vp: f.vapor_pressure && vp ? withConverted(f.vapor_pressure, vp) : EMPTY_CELL,
    waste: waste ? plain(waste) + (waste.status === 'pending' && waste.origin === 'rule' ? ' †' : '') : EMPTY_CELL,
    fire: plain(g('nfpa_fire')),
    health: plain(g('nfpa_health')),
    reactivity: plain(g('nfpa_reactivity')),
    special: plain(g('nfpa_special')),
    eyes: plain(g('exp_eyes')),
    skin: plain(g('exp_skin')),
    inhalation: plain(g('exp_inhalation')),
    ingestion: plain(g('exp_ingestion')),
  }
}

// ---- CSV ---------------------------------------------------------------------------
const csvCell = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

// Empty cells stay empty in the CSV (not "–"), so a spreadsheet sees a real blank.
export function toCsv(cards: ChemicalCard[]): string {
  const header = COLUMNS.map((c) => (c.group ? `${c.group}: ${c.label}` : c.label))
  const rows = cards.map((card) => {
    const cells = cellsFor(card)
    return COLUMNS.map((c) => csvCell(cells[c.id] === EMPTY_CELL ? '' : cells[c.id].replace(/\n/g, '; ')))
  })
  // BOM so Excel reads the degree signs correctly.
  return '﻿' + [header.map(csvCell), ...rows].map((r) => r.join(',')).join('\r\n') + '\r\n'
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

const SOURCE_NAMES: Record<string, string> = { pubchem: 'PubChem', niosh: 'NIOSH', cameo: 'CAMEO', user: 'Entered by hand', app: 'Rule in SafeMix', sds: 'Supplier SDS' }
const FIELD_ORDER: FieldKey[] = ['name', 'formula', 'mw', 'bp', 'mp', 'density', 'vapor_pressure', 'waste_container',
  'nfpa_fire', 'nfpa_health', 'nfpa_reactivity', 'nfpa_special', 'exp_eyes', 'exp_skin', 'exp_inhalation', 'exp_ingestion']

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
      out.push({
        chemical, field: FIELD_LABELS[k], value: f.value.replace(/\n/g, ' / '),
        source: `${SOURCE_NAMES[f.source]}${via}`, detail, retrieved: f.retrieved_at, url: f.source_url,
      })
    }
  }
  return out
}
