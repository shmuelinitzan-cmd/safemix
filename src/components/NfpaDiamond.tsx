import type { ChemicalCard } from '../types/card.ts'
import { NFPA_COLORS } from '../lib/cards.ts'

// Drawn in the four standard NFPA 704 colours. A missing value shows "–" (no data).
export default function NfpaDiamond({ card, size = 96 }: { card: ChemicalCard; size?: number }) {
  const v = (k: 'nfpa_fire' | 'nfpa_health' | 'nfpa_reactivity' | 'nfpa_special') => card.fields[k]?.value ?? '–'
  const quads = [
    { pts: '50,2 74,26 50,50 26,26', fill: NFPA_COLORS.fire, text: '#fff', x: 50, y: 31, v: v('nfpa_fire'), name: 'Fire' },
    { pts: '2,50 26,26 50,50 26,74', fill: NFPA_COLORS.health, text: '#fff', x: 27, y: 55, v: v('nfpa_health'), name: 'Health' },
    { pts: '98,50 74,26 50,50 74,74', fill: NFPA_COLORS.reactivity, text: '#000', x: 73, y: 55, v: v('nfpa_reactivity'), name: 'Reactivity' },
    { pts: '50,98 26,74 50,50 74,74', fill: NFPA_COLORS.special, text: '#000', x: 50, y: 79, v: v('nfpa_special'), name: 'Special' },
  ]
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img"
      aria-label={`NFPA 704: fire ${v('nfpa_fire')}, health ${v('nfpa_health')}, reactivity ${v('nfpa_reactivity')}, special ${v('nfpa_special')}`}>
      {quads.map((q) => (
        <g key={q.name}>
          <polygon points={q.pts} fill={q.fill} stroke="#111" strokeWidth="1.5" />
          <text x={q.x} y={q.y} textAnchor="middle" fontSize="15" fontWeight="700" fill={q.text}>{q.v}</text>
        </g>
      ))}
    </svg>
  )
}
