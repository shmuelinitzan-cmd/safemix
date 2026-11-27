import type { ChemicalCard } from '../types/card.ts'
import { NFPA_COLORS } from '../lib/cards.ts'
import { isNotVerified, NOT_VERIFIED } from '../lib/provenance.ts'

// Drawn in the four standard NFPA 704 colours. A missing value shows "–" (no data).
export default function NfpaDiamond({ card, size = 96 }: { card: ChemicalCard; size?: number }) {
  // "*" marks a number that is not verified; the caption under the diamond explains it.
  const v = (k: 'nfpa_fire' | 'nfpa_health' | 'nfpa_reactivity' | 'nfpa_special') =>
    (card.fields[k]?.value ?? '–') + (isNotVerified(card, k) ? '*' : '')
  // Long text from an entry that could not be read does not fit in the diamond: it shows "?*"
  // there, and the full text is in the card row and the label.
  const drawn = (k: Parameters<typeof v>[0]) => (card.fields[k]?.unverified && v(k).length > 4 ? '?*' : v(k))
  const quads = [
    { pts: '50,2 74,26 50,50 26,26', fill: NFPA_COLORS.fire, text: '#fff', x: 50, y: 31, v: v('nfpa_fire'), drawn: drawn('nfpa_fire'), name: 'Fire' },
    { pts: '2,50 26,26 50,50 26,74', fill: NFPA_COLORS.health, text: '#fff', x: 27, y: 55, v: v('nfpa_health'), drawn: drawn('nfpa_health'), name: 'Health' },
    { pts: '98,50 74,26 50,50 74,74', fill: NFPA_COLORS.reactivity, text: '#000', x: 73, y: 55, v: v('nfpa_reactivity'), drawn: drawn('nfpa_reactivity'), name: 'Reactivity' },
    { pts: '50,98 26,74 50,50 74,74', fill: NFPA_COLORS.special, text: '#000', x: 50, y: 79, v: v('nfpa_special'), drawn: drawn('nfpa_special'), name: 'Special' },
  ]
  const flagged = quads.some((q) => q.v.endsWith('*'))
  return (
    <span className="inline-flex flex-col items-center">
    <svg width={size} height={size} viewBox="0 0 100 100" role="img"
      aria-label={`NFPA 704: fire ${v('nfpa_fire')}, health ${v('nfpa_health')}, reactivity ${v('nfpa_reactivity')}, special ${v('nfpa_special')}${flagged ? `. * = ${NOT_VERIFIED}` : ''}`}>
      {quads.map((q) => (
        <g key={q.name}>
          <polygon points={q.pts} fill={q.fill} stroke="#111" strokeWidth="1.5" />
          <text x={q.x} y={q.y} textAnchor="middle" fontSize="15" fontWeight="700" fill={q.text}>{q.drawn}</text>
        </g>
      ))}
    </svg>
    {flagged && <span className="text-xs font-medium text-amber-800">* {NOT_VERIFIED}</span>}
    </span>
  )
}
