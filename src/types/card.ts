// SafeMix data model (SPEC.md v2): one compact card with exactly the columns of the
// lab's chemical table. Every value carries its provenance. Nothing else is on the card.

export type SourceId = 'pubchem' | 'niosh' | 'cameo' | 'user' | 'app'
export type Origin = 'source' | 'user' | 'rule'
export type Status = 'pending' | 'approved'

export interface Field {
  // The value exactly as the source gave it (original units kept).
  value: string
  unit?: string
  // Concentration/state the value applies to, e.g. ">60% solution". Only set when the
  // source text itself states one; copied word for word.
  condition?: string
  // 'relative_density' = a bare number relative to water (specific gravity); it has no unit.
  quantity?: 'relative_density'
  // Set when a person changed or corrected the value: why, and what the source had said.
  note?: string
  source_value?: string
  source: SourceId
  source_url: string
  retrieved_at: string // YYYY-MM-DD
  origin: Origin
  status: Status
  // Who PubChem itself got the value from (e.g. "ILO-WHO International Chemical Safety Cards (ICSCs)").
  upstream?: string
  // The citation PubChem gives for that value, when there is one.
  upstream_citation?: string
}

export const FIELD_KEYS = [
  'name', 'formula', 'mw',
  'bp', 'mp', 'density', 'vapor_pressure',
  'waste_container',
  'nfpa_fire', 'nfpa_health', 'nfpa_reactivity', 'nfpa_special',
  'exp_eyes', 'exp_skin', 'exp_inhalation', 'exp_ingestion',
] as const
export type FieldKey = (typeof FIELD_KEYS)[number]

export const FIELD_LABELS: Record<FieldKey, string> = {
  name: 'Chemical name', formula: 'Formula', mw: 'MW (g/mol)',
  bp: 'Boiling point (°C)', mp: 'Melting point (°C)', density: 'Density (g/mL)',
  vapor_pressure: 'Vapour pressure (mmHg)',
  waste_container: 'Waste container',
  nfpa_fire: 'NFPA 704 Fire', nfpa_health: 'NFPA 704 Health',
  nfpa_reactivity: 'NFPA 704 Reactivity', nfpa_special: 'NFPA 704 Special',
  exp_eyes: 'Exposure: eyes', exp_skin: 'Exposure: skin',
  exp_inhalation: 'Exposure: inhalation', exp_ingestion: 'Exposure: ingestion',
}

// The five waste categories. SPEC: these names must match the lab's own list.
export const WASTE_CATEGORIES = [
  'inorganic', 'acidic inorganic', 'basic', 'organic', 'halogenated organic',
] as const
export type WasteCategory = (typeof WASTE_CATEGORIES)[number]

export interface ChemicalCard {
  id: string
  // Search key used to find the record; not shown as a card column.
  cas?: Field
  pubchem_cid?: number
  created_at: string
  updated_at: string
  // A key that is absent has no data: the UI shows "No data from approved sources".
  fields: Partial<Record<FieldKey, Field>>
}

export const NO_DATA_LABEL = 'No data from approved sources'
