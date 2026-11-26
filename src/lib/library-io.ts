// Export / import of the whole library as one JSON file (to move data between computers).
// A file from elsewhere is untrusted: every record is checked and REBUILT field by field,
// links must be https://, pictures must be real PNG data URLs, and unknown keys are dropped.
import type { ChemicalCard, Field, Structure } from '../types/card.ts'
import { FIELD_KEYS } from '../types/card.ts'
import type { Experiment } from '../types/experiment.ts'

export const LIBRARY_FORMAT = 'safemix-library'
export const LIBRARY_VERSION = 1
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024

export interface LibraryFile {
  format: typeof LIBRARY_FORMAT
  version: number
  exported_at: string
  cards: ChemicalCard[]
  experiments: Experiment[]
}

export function exportLibrary(cards: ChemicalCard[], experiments: Experiment[], now = new Date()): string {
  const file: LibraryFile = { format: LIBRARY_FORMAT, version: LIBRARY_VERSION, exported_at: now.toISOString(), cards, experiments }
  return JSON.stringify(file, null, 1)
}

export class ImportError extends Error {}

const SOURCES = ['pubchem', 'niosh', 'cameo', 'user', 'app', 'sds']
const ORIGINS = ['source', 'user', 'rule']
const STATUSES = ['pending', 'approved']
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

function str(x: unknown, what: string, max = 5000, optional = false): string | undefined {
  if (x === undefined || x === null) {
    if (optional) return undefined
    throw new ImportError(`${what} is missing.`)
  }
  if (typeof x !== 'string' || x.length > max) throw new ImportError(`${what} is not valid text.`)
  return x
}
function oneOf(x: unknown, list: string[], what: string): string {
  if (typeof x !== 'string' || !list.includes(x)) throw new ImportError(`${what} has an unknown value.`)
  return x
}
function httpsUrl(x: unknown, what: string): string {
  const s = str(x ?? '', what, 2000)!
  if (s !== '' && !/^https:\/\/[^\s]+$/.test(s)) throw new ImportError(`${what} is not an https:// link.`)
  return s
}

function field(x: unknown, what: string): Field {
  if (!isObj(x)) throw new ImportError(`${what} is not a value record.`)
  const f: Field = {
    value: str(x.value, `${what} value`)!,
    source: oneOf(x.source, SOURCES, `${what} source`) as Field['source'],
    source_url: httpsUrl(x.source_url, `${what} link`),
    retrieved_at: str(x.retrieved_at, `${what} date`, 40)!,
    origin: oneOf(x.origin, ORIGINS, `${what} origin`) as Field['origin'],
    status: oneOf(x.status, STATUSES, `${what} status`) as Field['status'],
  }
  for (const k of ['unit', 'condition', 'note', 'source_value', 'upstream', 'upstream_citation'] as const) {
    const v = str(x[k], `${what} ${k}`, 5000, true)
    if (v !== undefined) f[k] = v
  }
  if (x.quantity !== undefined) f.quantity = oneOf(x.quantity, ['relative_density'], `${what} quantity`) as 'relative_density'
  return f
}

function structure(x: unknown, what: string): Structure {
  if (!isObj(x)) throw new ImportError(`${what} is not valid.`)
  const data_url = str(x.data_url, `${what} image`, 2_000_000)!
  if (!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(data_url)) throw new ImportError(`${what} image is not a PNG.`)
  return {
    data_url, source: 'pubchem', source_url: httpsUrl(x.source_url, `${what} link`),
    retrieved_at: str(x.retrieved_at, `${what} date`, 40)!, status: oneOf(x.status, STATUSES, `${what} status`) as Structure['status'],
  }
}

export function validateCard(x: unknown, index: number): ChemicalCard {
  const what = `Card ${index + 1}`
  if (!isObj(x)) throw new ImportError(`${what} is not a card.`)
  const id = str(x.id, `${what} id`, 200)!
  if (!id) throw new ImportError(`${what} has no id.`)
  if (!isObj(x.fields)) throw new ImportError(`${what} has no fields.`)
  const fields: ChemicalCard['fields'] = {}
  for (const k of FIELD_KEYS) if (x.fields[k] !== undefined) fields[k] = field(x.fields[k], `${what} ${k}`)
  const card: ChemicalCard = {
    id, fields,
    created_at: str(x.created_at, `${what} created date`, 40)!,
    updated_at: str(x.updated_at, `${what} updated date`, 40)!,
  }
  if (x.cas !== undefined) card.cas = field(x.cas, `${what} CAS`)
  if (x.pubchem_cid !== undefined) {
    if (typeof x.pubchem_cid !== 'number' || !Number.isInteger(x.pubchem_cid)) throw new ImportError(`${what} PubChem id is not a number.`)
    card.pubchem_cid = x.pubchem_cid
  }
  if (x.structure !== undefined) card.structure = structure(x.structure, `${what} picture`)
  if (x.concentration !== undefined) card.concentration = str(x.concentration, `${what} concentration`, 200)
  if (x.not_verified !== undefined) card.not_verified = str(x.not_verified, `${what} not-verified note`, 300)
  if (x.parent_id !== undefined) card.parent_id = str(x.parent_id, `${what} parent id`, 200)
  return card
}

export function validateExperiment(x: unknown, index: number): Experiment {
  const what = `Experiment ${index + 1}`
  if (!isObj(x)) throw new ImportError(`${what} is not valid.`)
  if (!Array.isArray(x.card_ids) || x.card_ids.length > 500) throw new ImportError(`${what} has no valid chemical list.`)
  return {
    id: str(x.id, `${what} id`, 200)!,
    name: str(x.name, `${what} name`, 300)!,
    card_ids: x.card_ids.map((c, i) => str(c, `${what} chemical ${i + 1}`, 200)!),
    created_at: str(x.created_at, `${what} created date`, 40)!,
    updated_at: str(x.updated_at, `${what} updated date`, 40)!,
  }
}

export function parseLibraryFile(text: string): { cards: ChemicalCard[]; experiments: Experiment[] } {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new ImportError('This file is not valid JSON.') }
  if (!isObj(raw) || raw.format !== LIBRARY_FORMAT) throw new ImportError('This is not a SafeMix library file.')
  if (typeof raw.version !== 'number' || raw.version > LIBRARY_VERSION) throw new ImportError('This file was made by a newer version of SafeMix.')
  if (!Array.isArray(raw.cards)) throw new ImportError('The file has no list of cards.')
  const experiments = raw.experiments === undefined ? [] : raw.experiments
  if (!Array.isArray(experiments)) throw new ImportError('The experiments list is not valid.')
  return { cards: raw.cards.map(validateCard), experiments: experiments.map(validateExperiment) }
}

export interface ImportPlan {
  newCards: ChemicalCard[]
  existingCards: ChemicalCard[] // already in the library (same id)
  newExperiments: Experiment[]
  existingExperiments: Experiment[]
}

export function planImport(
  incoming: { cards: ChemicalCard[]; experiments: Experiment[] },
  have: { cards: ChemicalCard[]; experiments: Experiment[] },
): ImportPlan {
  const cardIds = new Set(have.cards.map((c) => c.id))
  const expIds = new Set(have.experiments.map((e) => e.id))
  return {
    newCards: incoming.cards.filter((c) => !cardIds.has(c.id)),
    existingCards: incoming.cards.filter((c) => cardIds.has(c.id)),
    newExperiments: incoming.experiments.filter((e) => !expIds.has(e.id)),
    existingExperiments: incoming.experiments.filter((e) => expIds.has(e.id)),
  }
}
