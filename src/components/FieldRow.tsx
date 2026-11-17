import { useState } from 'react'
import type { Field, FieldKey } from '../types/card.ts'
import { FIELD_LABELS, NO_DATA_LABEL, WASTE_CATEGORIES } from '../types/card.ts'
import { densityForCard, temperatureForCard, vapourPressureForCard, type CardValue } from '../lib/units.ts'
import { shortSource } from '../lib/sources.ts'
import type { SdsCitation } from '../lib/cards.ts'

// The last SDS citation typed in, offered again for the next value (most values on a card
// come from the same SDS). Kept only while the page is open.
let lastSds: SdsCitation = { citation: '' }

const SOURCE_NAMES: Record<string, string> = { pubchem: 'PubChem', niosh: 'NIOSH', cameo: 'CAMEO', user: 'You (edited)', app: 'Rule', sds: 'Supplier SDS' }

// What the card shows for a value, and a converted version when the unit differs.
// The stored text is never changed; the full original goes in the source details.
function display(key: FieldKey, f: Field): CardValue {
  if (key === 'vapor_pressure') return vapourPressureForCard(f.value)
  if (key === 'bp' || key === 'mp') return temperatureForCard(f.value)
  if (key === 'density') return densityForCard(f.value)
  return { shown: f.value }
}

function badgeSuffix(f: Field): string | undefined {
  const short = shortSource(f.upstream)
  return short && short !== 'PubChem' ? short : undefined
}

function Details({ field, shown }: { field: Field; shown: string }) {
  const rows: [string, string | undefined][] = [
    ['Source', SOURCE_NAMES[field.source]],
    [field.source === 'sds' ? 'SDS' : 'Via', field.upstream],
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

export default function FieldRow({ k, field, onEdit }: { k: FieldKey; field?: Field; onEdit: (value: string, sds?: SdsCitation) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [fromSds, setFromSds] = useState(true)
  const [sds, setSds] = useState<SdsCitation>(lastSds)
  const start = () => { setDraft(field?.value ?? ''); setSds(lastSds); setFromSds(k !== 'waste_container' && k !== 'name'); setEditing(true) }
  const needsCitation = fromSds && !!draft.trim() && !sds.citation.trim()
  const save = () => {
    if (needsCitation) return
    if (fromSds) lastSds = sds
    onEdit(draft, fromSds ? sds : undefined); setEditing(false)
  }
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
            <button onClick={save} disabled={needsCitation} className="rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-40">Save</button>
            <button onClick={() => setEditing(false)} className="rounded border border-slate-300 px-3 py-1 text-sm">Cancel</button>
            {k !== 'waste_container' && (
              <div className="w-full space-y-1 rounded bg-slate-50 p-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={fromSds} onChange={(e) => setFromSds(e.target.checked)} />
                  From the supplier SDS
                </label>
                {fromSds && (
                  <div className="flex flex-wrap gap-2">
                    <input value={sds.citation} onChange={(e) => setSds({ ...sds, citation: e.target.value })}
                      placeholder="Supplier, product no., revision date (e.g. Sigma-Aldrich 438073, rev. 2024-03-12)"
                      aria-label="SDS citation" className="min-w-0 flex-[2] rounded border border-slate-300 px-2 py-1" />
                    <input value={sds.url ?? ''} onChange={(e) => setSds({ ...sds, url: e.target.value })}
                      placeholder="Link to the SDS (optional, https://)" aria-label="SDS link"
                      className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1" />
                  </div>
                )}
                {needsCitation && <p className="text-xs text-amber-700">Name the SDS, or untick the box to save it as entered by hand.</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {field ? (
              <span>
                {field.quantity === 'relative_density' && <span className="text-slate-500">relative density </span>}
                {conv ?? disp!.shown}
                {field.unit && k === 'mw' ? ` ${field.unit}` : ''}
                {field.condition && <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">applies to: {field.condition}</span>}
              </span>
            ) : (
              <span className="italic text-slate-400">{NO_DATA_LABEL}</span>
            )}
            {conv && <span className="text-sm text-slate-500"><em>converted from {disp!.from}</em></span>}
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
