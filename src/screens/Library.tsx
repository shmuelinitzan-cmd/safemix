import { useRef, useState } from 'react'
import type { ChemicalCard } from '../types/card.ts'
import type { Experiment } from '../types/experiment.ts'
import type { ImportPlan } from '../lib/library-io.ts'
import { isFullyApproved, matches } from '../lib/cards.ts'
import NfpaDiamond from '../components/NfpaDiamond.tsx'
import Intro from '../components/Intro.tsx'
import { isNotVerified, NOT_VERIFIED } from '../lib/provenance.ts'

interface Props {
  cards: ChemicalCard[] | null
  experiments: Experiment[]
  onOpen: (card: ChemicalCard) => void
  onLookup: (query: string) => Promise<void>
  onNewExperiment: () => void
  onOpenExperiment: (e: Experiment) => void
  onExportAll: () => void
  onImportFile: (file: File) => Promise<ImportPlan>
  onApplyImport: (plan: ImportPlan, replaceExisting: boolean) => Promise<void>
  error?: string
}

const btn = 'rounded border border-slate-300 bg-white px-4 py-2 hover:border-emerald-600'

export default function Library(p: Props) {
  const { cards, experiments } = p
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [ioMsg, setIoMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true); setLookupError('')
    try { await p.onLookup(query) } catch (err) { setLookupError(err instanceof Error ? err.message : 'Lookup failed.') }
    setBusy(false)
  }

  const chooseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // lets the same file be chosen again later
    if (!file) return
    setIoMsg(''); setPlan(null)
    try { setPlan(await p.onImportFile(file)) } catch (err) { setIoMsg(err instanceof Error ? err.message : 'Could not read this file.') }
  }
  const apply = async (replace: boolean) => {
    if (!plan) return
    try { await p.onApplyImport(plan, replace); setIoMsg('Import finished.') } catch { setIoMsg('Import failed. Your browser may be blocking local storage.') }
    setPlan(null)
  }

  const shown = (cards ?? []).filter((c) => matches(c, filter)).sort((a, b) => (a.fields.name?.value ?? '').localeCompare(b.fields.name?.value ?? ''))

  return (
    <section>
      <Intro />
      <form onSubmit={search} className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <label className="sr-only" htmlFor="lookup">Chemical name or CAS number</label>
        <input id="lookup" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Look up a new chemical: name or CAS number"
          className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2" />
        <button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Searching PubChem…' : 'Search PubChem'}</button>
      </form>
      {lookupError && <p role="alert" className="mt-2 text-sm text-red-700">{lookupError}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="filter">Search the library</label>
        <input id="filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search saved chemicals (name, formula, CAS)"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2" />
        <button onClick={p.onNewExperiment} className="rounded bg-emerald-700 px-4 py-2 text-white">New experiment</button>
        <button onClick={() => fileRef.current?.click()} className={btn}>Import</button>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={chooseFile} className="hidden" aria-label="Choose a SafeMix library file" />
        <button onClick={p.onExportAll} disabled={!cards?.length} className={`${btn} disabled:opacity-40`}>Export all</button>
        <button disabled title="Coming in a later phase" className="rounded border border-slate-300 bg-white px-4 py-2 opacity-50">Compatibility check: coming soon</button>
      </div>

      {plan && (
        <div role="region" aria-label="Import" className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm">
          <p className="font-medium">This file has {plan.newCards.length + plan.existingCards.length} chemical(s) and {plan.newExperiments.length + plan.existingExperiments.length} experiment(s).</p>
          <p className="mt-1">New to this library: {plan.newCards.length} chemical(s), {plan.newExperiments.length} experiment(s). Already here (same id): {plan.existingCards.length} chemical(s), {plan.existingExperiments.length} experiment(s).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button onClick={() => apply(false)} className="rounded bg-emerald-700 px-3 py-1.5 text-white">Add the new ones, keep mine</button>
            <button onClick={() => apply(true)} disabled={plan.existingCards.length + plan.existingExperiments.length === 0}
              className="rounded border border-slate-400 bg-white px-3 py-1.5 disabled:opacity-40">Add new and replace the ones already here</button>
            <button onClick={() => setPlan(null)} className="rounded border border-slate-300 bg-white px-3 py-1.5">Cancel</button>
          </div>
        </div>
      )}
      {ioMsg && <p role="status" className="mt-2 text-sm text-slate-700">{ioMsg}</p>}

      {p.error && <p role="alert" className="mt-4 text-sm text-red-700">{p.error}</p>}
      {cards === null && !p.error && <p className="mt-6 text-slate-500">Loading…</p>}
      {cards && shown.length === 0 && (
        <div className="mt-8 rounded-lg border-2 border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold">{cards.length ? 'No chemical matches your search' : 'Your library is empty'}</h2>
          <p className="mt-1 text-slate-600">Look up a chemical above to create a card.</p>
        </div>
      )}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {shown.map((c) => (
          <li key={c.id}>
            <button onClick={() => p.onOpen(c)} className="flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-emerald-600">
              <span className="flex w-24 shrink-0 justify-center"><NfpaDiamond card={c} size={64} /></span>
              <span>
                <span className="block font-semibold">{c.fields.name?.value}</span>
                {isNotVerified(c, 'name') && <span className="block text-xs text-amber-800">Name: {NOT_VERIFIED}</span>}
                <span className="block text-sm text-slate-600">{c.fields.formula?.value ?? '—'}{isNotVerified(c, 'formula') ? ` (${NOT_VERIFIED})` : ''} · CAS {c.cas?.value ?? '—'}</span>
                <span className={`mt-1 inline-block rounded px-1.5 text-xs ${isFullyApproved(c) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {isFullyApproved(c) ? 'Approved' : 'Needs review'}
                </span>
                {c.not_verified && <span className="ml-1 mt-1 inline-block rounded bg-amber-100 px-1.5 text-xs text-amber-800">{c.not_verified}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {experiments.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-lg font-semibold text-emerald-800">Experiments</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...experiments].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map((e) => (
              <li key={e.id}>
                <button onClick={() => p.onOpenExperiment(e)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-emerald-600">
                  <span className="block font-semibold">{e.name}</span>
                  <span className="block text-sm text-slate-600">{e.card_ids.length} chemical{e.card_ids.length === 1 ? '' : 's'} · updated {e.updated_at}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
