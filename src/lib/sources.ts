// Short names for the source badges. The full name is always available on hover and in the details.

// A name with an acronym in brackets uses it: "Hazardous Substances Data Bank (HSDB)" -> "HSDB".
// "ICSCs" is shown as "ICSC". Names without one are listed here; anything else is shown in full.
const KNOWN: Record<string, string> = {
  'CAMEO Chemicals': 'CAMEO',
  'PubChem': 'PubChem',
  'PubChem record title': 'PubChem',
}

export function shortSource(upstream: string | undefined): string | undefined {
  if (!upstream) return undefined
  if (KNOWN[upstream]) return KNOWN[upstream]
  const acronym = /\(([A-Z][A-Za-z-]{1,9})\)\s*$/.exec(upstream)?.[1]
  if (acronym) return acronym.replace(/^ICSCs$/, 'ICSC')
  return upstream // unknown: show it whole rather than guess an abbreviation
}
