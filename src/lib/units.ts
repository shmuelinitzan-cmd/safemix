// Display-only unit conversion. The card stores the source value as given; these helpers
// only produce a "converted" hint to show next to it. Plain arithmetic, no data lookup.

const NUM = '(-?\\d+(?:\\.\\d+)?)'
const QUAL = '((?:greater|less|more) than\\s+|>=?\\s*|<=?\\s*|about\\s+|approx\\.?\\s+)?'

function round1(x: number) {
  return Math.round(x * 10) / 10
}

// Converts only the LEADING quantity of the text (so "180 mmHg at 68 °F" is untouched:
// the 68 °F is the measuring temperature, not the value).
export function convertTemperature(value: string): string | undefined {
  const m = new RegExp(`^\\s*${QUAL}${NUM}\\s*(°\\s?F|°\\s?C|K)\\b`, 'i').exec(value)
  if (!m) return undefined
  const n = Number(m[2])
  const unit = m[3].replace(/\s/g, '').toUpperCase()
  if (unit === '°C') return undefined // already °C
  const c = unit === '°F' ? ((n - 32) * 5) / 9 : n - 273.15
  return `${m[1] ?? ''}${round1(c)} °C`
}

const TO_MMHG: Record<string, number> = { mmhg: 1, kpa: 7.50062, pa: 0.00750062, bar: 750.062, atm: 760, torr: 1 }

export function convertPressure(value: string): string | undefined {
  const m = new RegExp(`^\\s*${QUAL}${NUM}\\s*(mmHg|kPa|Pa|bar|atm|torr)\\b`, 'i').exec(value)
  if (!m) return undefined
  const unit = m[3].toLowerCase()
  if (unit === 'mmhg') return undefined // already mmHg
  const mm = Number(m[2]) * TO_MMHG[unit]
  return `${m[1] ?? ''}${Number(mm.toPrecision(3))} mmHg`
}

// ---- Vapour pressure for the card ------------------------------------------------
// The source text can hold several values ("180 mmHg at 68 °F ; 270 mmHg at 86 °F (NTP, 1992)").
// The card shows only the FIRST value with its temperature, and a labelled conversion of the
// temperature (°F -> °C) and, if needed, of the pressure (-> mmHg). The stored text is not changed.
const CITATION_AT_END = /\s*\([A-Za-z.&/ ]+,\s*\d{4}\)\s*$/ // "(NTP, 1992)", "(NIOSH, 2024)"

export function vapourPressureForCard(value: string): { shown: string; converted?: string } {
  const first = value.split(/\s*;\s*/)[0].replace(CITATION_AT_END, '').trim()
  let conv = first
  // groups: 1 = leading space + qualifier, 2 = the qualifier alone (from QUAL), 3 = number, 4 = unit
  const lead = new RegExp(`^(\\s*${QUAL})${NUM}\\s*(mmHg|kPa|Pa|bar|atm|torr)\\b`, 'i').exec(first)
  if (lead && lead[4].toLowerCase() !== 'mmhg') {
    const mm = Number(lead[3]) * TO_MMHG[lead[4].toLowerCase()]
    conv = `${lead[1]}${Number(mm.toPrecision(3))} mmHg${first.slice(lead[0].length)}`
  }
  conv = conv.replace(/(\bat\s+)(-?\d+(?:\.\d+)?)\s*°\s?F\b/i, (_, at, n) => `${at}${round1(((Number(n) - 32) * 5) / 9)} °C`)
  return { shown: first, converted: conv !== first ? conv : undefined }
}
