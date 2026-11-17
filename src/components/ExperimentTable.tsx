import type { ChemicalCard } from '../types/card.ts'
import { COLUMNS, cellsFor, FOOTNOTES, ghsInsteadOfNfpa, NFPA_IDS } from '../lib/table.ts'

interface Props {
  cards: ChemicalCard[]
  onMove?: (index: number, delta: -1 | 1) => void
  onRemove?: (index: number) => void
}

// The lab form as an on-screen table. Cell text comes from the same function as the PDF and CSV.
// Minimum widths so values like "BP: 117.9 °C" do not break in the middle.
const MIN_WIDTH: Record<string, string> = { name: 'min-w-[7.5rem]', formula: 'min-w-[5rem]', bpmp: 'min-w-[8.5rem]', density: 'min-w-[7rem]', vp: 'min-w-[9rem]',
  waste: 'min-w-[6rem]', eyes: 'min-w-[9rem]', skin: 'min-w-[9rem]', inhalation: 'min-w-[10rem]', ingestion: 'min-w-[10rem]' }

export default function ExperimentTable({ cards, onMove, onRemove }: Props) {
  const groups = [...new Set(COLUMNS.map((c) => c.group).filter(Boolean))] as string[]
  const edit = !!(onMove || onRemove)
  const th = 'border border-slate-300 bg-emerald-800 px-2 py-1 text-center font-semibold text-white'
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1300px] border-collapse text-xs">
          <thead>
            <tr>
              {edit && <th rowSpan={2} className={th}><span className="sr-only">Row</span></th>}
              {COLUMNS.filter((c) => !c.group).map((c) => <th key={c.id} rowSpan={2} className={th}>{c.label}</th>)}
              {groups.map((g) => <th key={g} colSpan={COLUMNS.filter((c) => c.group === g).length} className={th}>{g}</th>)}
            </tr>
            <tr>
              {COLUMNS.filter((c) => c.group).map((c) => (
                <th key={c.id} className="border border-slate-300 px-2 py-1 text-center font-semibold"
                  style={c.group === 'NFPA 704'
                    ? { background: c.fill, color: c.id === 'fire' || c.id === 'health' ? '#fff' : '#000' }
                    : { background: '#065f46', color: '#fff' }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cards.map((card, i) => {
              const cells = cellsFor(card)
              const ghs = ghsInsteadOfNfpa(card)
              return (
                <tr key={card.id} className="align-top">
                  {edit && (
                    <td className="whitespace-nowrap border border-slate-300 px-1 py-1 text-center">
                      <button aria-label={`Move ${card.fields.name?.value} up`} disabled={i === 0} onClick={() => onMove?.(i, -1)} className="px-1 disabled:opacity-30">↑</button>
                      <button aria-label={`Move ${card.fields.name?.value} down`} disabled={i === cards.length - 1} onClick={() => onMove?.(i, 1)} className="px-1 disabled:opacity-30">↓</button>
                      <button aria-label={`Remove ${card.fields.name?.value} from this table`} onClick={() => onRemove?.(i)} className="px-1 text-red-700">×</button>
                    </td>
                  )}
                  {COLUMNS.map((c) => {
                    if (ghs && NFPA_IDS.includes(c.id)) {
                      if (c.id !== 'fire') return null
                      return <td key="ghs" colSpan={NFPA_IDS.length} className="border border-slate-300 bg-orange-50 px-2 py-1 text-[11px] text-orange-950">{ghs}</td>
                    }
                    return (
                      <td key={c.id} className={`whitespace-pre-line border border-slate-300 px-2 py-1 ${MIN_WIDTH[c.id] ?? ''} ${c.group === 'NFPA 704' ? 'text-center font-bold' : ''}`}>
                        {cells[c.id]}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
        {FOOTNOTES.map((n) => <li key={n}>{n}</li>)}
      </ul>
    </div>
  )
}
