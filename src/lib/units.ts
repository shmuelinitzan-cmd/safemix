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
