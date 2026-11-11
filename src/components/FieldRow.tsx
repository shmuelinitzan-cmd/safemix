import { useState } from 'react'
import type { Field, FieldKey } from '../types/card.ts'
import { FIELD_LABELS, NO_DATA_LABEL, WASTE_CATEGORIES } from '../types/card.ts'
import { convertTemperature, vapourPressureForCard } from '../lib/units.ts'
import { shortSource } from '../lib/sources.ts'

const SOURCE_NAMES: Record<string, string> = { pubchem: 'PubChem', niosh: 'NIOSH', cameo: 'CAMEO', user: 'You (edited)', app: 'Rule' }

// What the card shows for a value, and a converted version when the unit differs.
// The stored text is never changed; the full original goes in the source details.
function display(key: FieldKey, f: Field): { shown: string; converted?: string } {
  if (key === 'vapor_pressure') return vapourPressureForCard(f.value)
  if (key === 'bp' || key === 'mp') return { shown: f.value, converted: convertTemperature(f.value) }
  return { shown: f.value }
}

function badgeSuffix(f: Field): string | undefined {
  const short = shortSource(f.upstream)
  return short && short !== 'PubChem' ? short : undefined
}

function Details({ field, shown }: { field: Field; shown: string }) {
  const rows: [string, string | undefined][] = [
    ['Source', SOURCE_NAMES[field.source]],
    ['Via', field.upstream],
    ['Citation', field.upstream_citation],
    ['Original text', field.value !== shown ? field.value : undefined],
    ['Retrieved', field.retrieved_at],
    ['Link', field.source_url || undefined],
  ]
  return (
    <details className="mt-1 text-xs text-slate-600">
      <summary className="cursor-pointer text-slate-500">Source details</summary>
      <dl className="mt-1 grid grid-cols-[6rem_1fr] gap-x-2 gap-y-0.5">
        {rows.filter(([, v]) => v).map(([l, v]) => (
          <div key={l} className="contents">
            <dt className="text-slate-500">{l}</dt>
            <dd className="break-words">{l === 'Link' ? <a href={v} target="_blank" rel="noreferrer" className="underline">{v}</a> : v}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

export default function FieldRow({ k, field, onEdit }: { k: FieldKey; field?: Field; onEdit: (value: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const start = () => { setDraft(field?.value ?? ''); setEditing(true) }
  const save = () => { onEdit(draft); setEditing(false) }
  const disp = field && display(k, field)
  const conv = disp?.converted
  const isRule = field?.origin === 'rule' && field.status !== 'approved'

  return (
    <div className="grid gap-1 border-b border-slate-100 py-2 sm:grid-cols-[11rem_1fr]">
      <div className="text-sm font-medium text-slate-600">{FIELD_LABELS[k]}</div>
      <div>
        {editing ? (
          <div className="flex flex-wrap gap-2">
            {k === 'waste_container' ? (
              <select value={draft} onChange={(e) => setDraft(e.target.value)} className="rounded border border-slate-300 px-2 py-1" aria-label={FIELD_LABELS[k]}>
                <option value="">(none)</option>
                {WASTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            ) : (
              <input value={draft} onChange={(e) => setDraft(e.target.value)} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1" aria-label={FIELD_LABELS[k]} />
            )}
            <button onClick={save} className="rounded bg-emerald-700 px-3 py-1 text-sm text-white">Save</button>
            <button onClick={() => setEditing(false)} className="rounded border border-slate-300 px-3 py-1 text-sm">Cancel</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {field ? (
              <span>
                {field.quantity === 'relative_density' && <span className="text-slate-500">relative density </span>}
                {disp!.shown}
                {field.unit && k === 'mw' ? ` ${field.unit}` : ''}
                {field.condition && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">applies to: {field.condition}</span>}
              </span>
            ) : (
              <span className="italic text-slate-400">{NO_DATA_LABEL}</span>
            )}
            {conv && <span className="text-sm text-slate-500">≈ {conv} <em>(converted)</em></span>}
            {field && (
              <a href={field.source_url || undefined} target="_blank" rel="noreferrer"
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                title={[SOURCE_NAMES[field.source], field.upstream && `via ${field.upstream}`, `retrieved ${field.retrieved_at}`].filter(Boolean).join(' · ')}>
                {SOURCE_NAMES[field.source]}{field.source === 'pubchem' && badgeSuffix(field) ? ` · ${badgeSuffix(field)}` : ''}
              </a>
            )}
            <button onClick={start} className="text-sm text-emerald-700 underline">Edit</button>
          </div>
        )}
        {field && !editing && <Details field={field} shown={disp!.shown} />}
        {isRule && <p className="mt-1 text-xs text-amber-700">Rule-based, confirm with lab instructions.</p>}
        {field?.note && <p className="mt-1 text-xs text-slate-600">{field.note}{field.source_value ? ` (PubChem had: ${field.source_value})` : ''}</p>}
      </div>
    </div>
  )
}
