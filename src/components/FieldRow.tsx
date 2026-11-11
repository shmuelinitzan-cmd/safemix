import { useState } from 'react'
import type { Field, FieldKey } from '../types/card.ts'
import { FIELD_LABELS, NO_DATA_LABEL, WASTE_CATEGORIES } from '../types/card.ts'
import { convertPressure, convertTemperature } from '../lib/units.ts'

const SOURCE_NAMES: Record<string, string> = { pubchem: 'PubChem', niosh: 'NIOSH', cameo: 'CAMEO', user: 'You (edited)', app: 'Rule' }

function converted(key: FieldKey, f: Field): string | undefined {
  if (key === 'bp' || key === 'mp') return convertTemperature(f.value)
  if (key === 'vapor_pressure') return convertPressure(f.value)
}

export default function FieldRow({ k, field, onEdit }: { k: FieldKey; field?: Field; onEdit: (value: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const start = () => { setDraft(field?.value ?? ''); setEditing(true) }
  const save = () => { onEdit(draft); setEditing(false) }
  const conv = field && converted(k, field)
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
                {field.value}
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
                title={[field.upstream && `via ${field.upstream}`, `retrieved ${field.retrieved_at}`].filter(Boolean).join(' · ')}>
                {SOURCE_NAMES[field.source]}{field.upstream && field.source === 'pubchem' ? ` · ${field.upstream.replace(/\s*\(.*\)$/, '').slice(0, 28)}` : ''}
              </a>
            )}
            <button onClick={start} className="text-sm text-emerald-700 underline">Edit</button>
          </div>
        )}
        {isRule && <p className="mt-1 text-xs text-amber-700">Rule-based, confirm with lab instructions.</p>}
        {field?.note && <p className="mt-1 text-xs text-slate-600">{field.note}{field.source_value ? ` (PubChem had: ${field.source_value})` : ''}</p>}
      </div>
    </div>
  )
}
