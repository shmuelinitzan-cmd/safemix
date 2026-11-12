import { useState } from 'react'
import type { ChemicalCard } from '../types/card.ts'
import type { Experiment } from '../types/experiment.ts'
import ExperimentTable from '../components/ExperimentTable.tsx'
import { toCsv } from '../lib/table.ts'
import { downloadFile, slug } from '../lib/download.ts'
import { buildExperimentPdf, DISCLAIMER } from '../lib/pdf.ts'

interface Props {
  experiment: Experiment
  saved: boolean
  library: ChemicalCard[]
  onSave: (e: Experiment) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onBack: () => void
}

export default function ExperimentScreen({ experiment, saved, library, onSave, onDelete, onBack }: Props) {
  const [name, setName] = useState(experiment.name)
  const [ids, setIds] = useState(experiment.card_ids)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedState, setSavedState] = useState({ name: experiment.name, ids: experiment.card_ids, saved })

  const byId = new Map(library.map((c) => [c.id, c]))
  const rows = ids.map((id) => byId.get(id)).filter((c): c is ChemicalCard => !!c)
  const missing = ids.length - rows.length
  const dirty = !savedState.saved || name !== savedState.name || ids.join() !== savedState.ids.join()
  const title = name.trim() || 'Experiment'

  const toggle = (id: string) => { setIds(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]); setMsg('') }
  const move = (i: number, d: -1 | 1) => {
    const live = rows.map((c) => c.id)
    ;[live[i], live[i + d]] = [live[i + d], live[i]]
    setIds(live)
  }

  const save = async () => {
    const e: Experiment = { ...experiment, name: title, card_ids: rows.map((c) => c.id), updated_at: new Date().toISOString().slice(0, 10) }
    try {
      await onSave(e)
      setName(e.name); setIds(e.card_ids)
      setSavedState({ name: e.name, ids: e.card_ids, saved: true })
      setMsg('Experiment saved on this computer.')
    } catch { setMsg('Could not save. Your browser may be blocking local storage (private window?).') }
  }

  const pdf = async () => {
    setBusy(true); setMsg('')
    try {
      const bytes = await buildExperimentPdf(title, rows, new Date().toISOString().slice(0, 10))
      downloadFile(`safemix-${slug(title)}.pdf`, bytes, 'application/pdf')
    } catch { setMsg('Could not make the PDF.') }
    setBusy(false)
  }
  const csv = () => downloadFile(`safemix-${slug(title)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')

  const sorted = [...library].sort((a, b) => (a.fields.name?.value ?? '').localeCompare(b.fields.name?.value ?? ''))

  return (
    <div>
      <button onClick={onBack} className="mb-3 text-sm text-emerald-700 underline">← Back to library</button>
      <div role="note" className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">{DISCLAIMER}</div>

      <label className="block text-sm font-medium text-slate-600" htmlFor="exp-name">Experiment name</label>
      <input id="exp-name" value={name} onChange={(e) => { setName(e.target.value); setMsg('') }}
        className="mb-4 w-full max-w-md rounded border border-slate-300 bg-white px-3 py-2 text-lg font-semibold" />

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-2 font-semibold text-emerald-800">Chemicals from your library</h3>
        {library.length === 0 ? (
          <p className="text-sm text-slate-600">Your library is empty. Look up a chemical on the library page first.</p>
        ) : (
          <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2 py-0.5">
                  <input type="checkbox" checked={ids.includes(c.id)} onChange={() => toggle(c.id)} />
                  <span>{c.fields.name?.value} <span className="text-sm text-slate-500">{c.fields.formula?.value}</span></span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      {missing > 0 && <p className="mb-2 text-sm text-amber-800">{missing} chemical{missing === 1 ? ' is' : 's are'} no longer in the library and will be dropped when you save.</p>}
      {rows.length === 0
        ? <p className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">Tick chemicals above to add them as rows.</p>
        : <ExperimentTable cards={rows} onMove={move} onRemove={(i) => toggle(rows[i].id)} />}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={!dirty} className="rounded bg-emerald-700 px-5 py-2 font-medium text-white disabled:opacity-40">Save experiment</button>
        <button onClick={pdf} disabled={busy || rows.length === 0} className="rounded border border-emerald-700 px-4 py-2 text-emerald-800 disabled:opacity-40">{busy ? 'Making PDF…' : 'Export PDF'}</button>
        <button onClick={csv} disabled={rows.length === 0} className="rounded border border-emerald-700 px-4 py-2 text-emerald-800 disabled:opacity-40">Export CSV</button>
        {savedState.saved && (
          <button onClick={async () => { if (confirm('Delete this experiment? Your chemicals stay in the library.')) { await onDelete(experiment.id); onBack() } }}
            className="rounded border border-red-300 px-4 py-2 text-red-700">Delete experiment</button>
        )}
        <span role="status" className="text-sm text-slate-700">{msg || (dirty ? 'Unsaved changes.' : savedState.saved ? 'Saved.' : '')}</span>
      </div>
    </div>
  )
}
