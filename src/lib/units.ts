// Display-only unit conversion. The card stores the source value as given; these helpers
// only produce a "converted" hint to show next to it. Plain arithmetic, no data lookup.

const NUM = '(-?\\d+(?:\\.\\d+)?)'
const QUAL = '((?:greater|less|more) than\\s+|>=?\\s*|<=?\\s*|about\\s+|approx\\.?\\s+)?'

function round1(x: number) {
  return Math.round(x * 10) / 10
}

// Cautious rule for ranges: a range that cannot be converted as a whole is left exactly as
// the source wrote it. Converting only its first end would mix two units in one value.
const RANGE_LINK = `\\s*(?:-|–|—|−|to\\b)\\s*${QUAL}[-−]?\\d`
const continuesAsRange = (rest: string) => new RegExp(`^${RANGE_LINK}`, 'i').test(rest)

// A pressure range with an end in a unit other than mmHg, e.g. "10 kPa - 20 kPa" or "10-20 kPa".
const P_UNIT = '(?:mmHg|kPa|Pa|bar|atm|torr)\\b'
const PRESSURE_RANGE = new RegExp(`^\\s*${QUAL}${NUM}\\s*(?<first>${P_UNIT})?${RANGE_LINK}\\d*(?:\\.\\d+)?\\s*(?<second>${P_UNIT})?`, 'i')
function isUnconvertedPressureRange(value: string): boolean {
  const units = PRESSURE_RANGE.exec(value)?.groups
  return !!units && [units.first, units.second].some((u) => u && u.toLowerCase() !== 'mmhg')
}

// Converts only the LEADING quantity of the text (so "180 mmHg at 68 °F" is untouched:
// the 68 °F is the measuring temperature, not the value).
export function convertTemperature(value: string): string | undefined {
  const m = new RegExp(`^\\s*${QUAL}${NUM}\\s*(°\\s?F|°\\s?C|K)\\b`, 'i').exec(value)
  if (!m || continuesAsRange(value.slice(m[0].length))) return undefined
  const n = Number(m[2])
  const unit = m[3].replace(/\s/g, '').toUpperCase()
  if (unit === '°C') return undefined // already °C
  const c = unit === '°F' ? ((n - 32) * 5) / 9 : n - 273.15
  return `${m[1] ?? ''}${round1(c)} °C`
}

const TO_MMHG: Record<string, number> = { mmhg: 1, kpa: 7.50062, pa: 0.00750062, bar: 750.062, atm: 760, torr: 1 }

export function convertPressure(value: string): string | undefined {
  const m = new RegExp(`^\\s*${QUAL}${NUM}\\s*(mmHg|kPa|Pa|bar|atm|torr)\\b`, 'i').exec(value)
  if (!m || continuesAsRange(value.slice(m[0].length))) return undefined
  const unit = m[3].toLowerCase()
  if (unit === 'mmhg') return undefined // already mmHg
  const mm = Number(m[2]) * TO_MMHG[unit]
  return `${m[1] ?? ''}${Number(mm.toPrecision(3))} mmHg`
}

// ---- Tidy source text for the card ---------------------------------------------
// PubChem copies its sources' wording, so values carry notes like "(USCG, 1999)",
// " - Denser than water; will sink", "@25 °C" or "[mm Hg]". For display only, these are
// trimmed to the value itself. The stored text is not changed and is shown in full in the
// source details and on the PDF sources page.
const CITATION_AT_END = /\s*\([A-Za-z.&/ ]+,\s*\d{4}\)\s*$/ // "(NTP, 1992)", "(NIOSH, 2024)"
export function tidy(value: string): string {
  return value
    .replace(/\s+-\s+(?:Denser|Less dense) than water.*$/i, '')
    .replace(CITATION_AT_END, '')
    .replace(/^(?:boiling point|melting point|vapou?r pressure|density)\s*:\s*/i, '')
    .replace(/\[\s*mm\s*Hg\s*\]|\bmm Hg\b/gi, 'mmHg')
    .replace(/\s*@\s*/g, ' at ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const AT_F = /(\bat\s+)(-?\d+(?:\.\d+)?)\s*°\s?F\b/i
// A range of measuring temperatures with an end in °F, e.g. "at 68 °F to 86 °F" or "at 68-86 °F".
// Same cautious rule as other ranges: nothing in such a value is converted.
const T_UNIT = '°\\s?[CF]\\b'
const AT_RANGE = new RegExp(`\\bat\\s+${NUM}\\s*(?<first>${T_UNIT})?${RANGE_LINK}\\d*(?:\\.\\d+)?\\s*(?<second>${T_UNIT})?`, 'i')
function isUnconvertedAtRange(value: string): boolean {
  const units = AT_RANGE.exec(value)?.groups
  return !!units && [units.first, units.second].some((u) => u && /f$/i.test(u))
}

const AT_TEMP_C = (s: string): number | undefined => {
  const m = /\bat\s+(-?\d+(?:\.\d+)?)\s*°\s?([CF])\b/i.exec(s)
  if (!m) return undefined
  const n = Number(m[1])
  return m[2].toUpperCase() === 'F' ? ((n - 32) * 5) / 9 : n
}

export interface CardValue {
  shown: string // the value as the source gave it (one value, tidied)
  converted?: string // the same value in the card's units, when the source used other units
  from?: string // the part of `shown` that was converted, e.g. "68 °F" or "24 kPa"
}

// ---- Vapour pressure for the card ------------------------------------------------
// The source text can hold several values ("40 mmHg at 41 °F ; 80.1 mmHg at 68 °F (NTP, 1992)").
// The card shows ONE value: the one measured closest to room temperature (20 °C); if none
// states a temperature, the first. Then a labelled conversion of the temperature (°F -> °C)
// and, if needed, of the pressure (-> mmHg). The stored text is not changed.
const ROOM_C = 20
export function vapourPressureForCard(value: string): CardValue {
  const parts = value.split(/\s*;\s*/).map(tidy).filter(Boolean)
  const withTemp = parts.map((p) => ({ p, t: AT_TEMP_C(p) })).filter((x) => x.t !== undefined)
  const first = withTemp.length
    ? withTemp.reduce((a, b) => (Math.abs(b.t! - ROOM_C) < Math.abs(a.t! - ROOM_C) ? b : a)).p
    : parts[0] ?? value
  // ICSC style: "Vapour pressure, kPa at 20 °C: 2 - 2.5" -> one value or range, in mmHg.
  const icsc = /^vapou?r pressure,\s*(kPa|Pa)\s+at\s+(-?\d+(?:\.\d+)?\s*°\s?C)\s*:\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*$/i.exec(first)
  if (icsc) {
    const k = TO_MMHG[icsc[1].toLowerCase()]
    const mm = (n: string) => Number((Number(n) * k).toPrecision(3))
    const range = icsc[4] ? `${mm(icsc[3])} - ${mm(icsc[4])}` : `${mm(icsc[3])}`
    const orig = icsc[4] ? `${icsc[3]} - ${icsc[4]} ${icsc[1]}` : `${icsc[3]} ${icsc[1]}`
    return { shown: `${orig} at ${icsc[2]}`, converted: `${range} mmHg at ${icsc[2]}`, from: orig }
  }
  if (isUnconvertedPressureRange(first) || isUnconvertedAtRange(first)) return { shown: first }
  let conv = first
  const from: string[] = []
  // groups: 1 = leading space + qualifier, 2 = the qualifier alone (from QUAL), 3 = number, 4 = unit
  const lead = new RegExp(`^(\\s*${QUAL})${NUM}\\s*(mmHg|kPa|Pa|bar|atm|torr)\\b`, 'i').exec(first)
  if (lead && lead[4].toLowerCase() !== 'mmhg') {
    const mm = Number(lead[3]) * TO_MMHG[lead[4].toLowerCase()]
    conv = `${lead[1]}${Number(mm.toPrecision(3))} mmHg${first.slice(lead[0].length)}`
    from.push(lead[0].trim())
  }
  const temp = AT_F.exec(conv)
  if (temp) {
    conv = conv.replace(temp[0], `${temp[1]}${round1(((Number(temp[2]) - 32) * 5) / 9)} °C`)
    from.push(`${temp[2]} °F`)
  }
  if (conv === first) return { shown: first }
  // Both converted: name the whole original; one converted: name just that part.
  return { shown: first, converted: conv, from: from.length === 2 ? first : from[0] }
}

// BP / MP: the leading temperature converted to °C, keeping the rest ("at 760 mmHg").
export function temperatureForCard(value: string): CardValue {
  const v = tidy(value)
  const m = new RegExp(`^\\s*${QUAL}${NUM}\\s*(°\\s?F|°\\s?C|K)\\b`, 'i').exec(v)
  const c = convertTemperature(v)
  if (!m || !c) return { shown: v }
  return { shown: v, converted: c + v.slice(m[0].length), from: `${m[2]} ${m[3].replace(/\s/g, '')}` }
}

// Density: 1 cm³ = 1 mL exactly, so the source's "g/cu cm" or "g/cm³" is shown as g/mL
// (the card's unit). Only the unit's spelling changes; the number is untouched. A measuring
// temperature in °F ("at 68 °F") gets the same labelled °C conversion as elsewhere.
const G_PER_CC = /g\s*\/\s*(?:cu\.?\s*cm|cm\s*3|cm³|cc)(?![a-z])/i
export function densityForCard(value: string): CardValue {
  const shown = tidy(value).replace(G_PER_CC, 'g/mL').replace(/g\/mL\s+(-?\d+(?:\.\d+)?\s*°\s?C)/, 'g/mL at $1')
  const temp = AT_F.exec(shown)
  if (!temp || isUnconvertedAtRange(shown)) return { shown }
  return { shown, converted: shown.replace(temp[0], `${temp[1]}${round1(((Number(temp[2]) - 32) * 5) / 9)} °C`), from: `${temp[2]} °F` }
}
