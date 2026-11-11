import { useState } from 'react'
import type { ChemicalCard } from '../types/card.ts'
import { isFullyApproved, matches } from '../lib/cards.ts'
import NfpaDiamond from '../components/NfpaDiamond.tsx'

interface Props {
  cards: ChemicalCard[] | null
  onOpen: (card: ChemicalCard) => void
  onLookup: (query: string) => Promise<void>
  error?: string
}

export default function Library({ cards, onOpen, onLookup, error }: Props) {
  const [filter, setFilter] = useState('')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [lookupError, setLookupError] = useState('')

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setBusy(true); setLookupError('')
    try { await onLookup(query) } catch (err) { setLookupError(err instanceof Error ? err.message : 'Lookup failed.') }
    setBusy(false)
  }
  const shown = (cards ?? []).filter((c) => matches(c, filter)).sort((a, b) => (a.fields.name?.value ?? '').localeCompare(b.fields.name?.value ?? ''))

  return (
    <section>
      <form onSubmit={search} className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <label className="sr-only" htmlFor="lookup">Chemical name or CAS number</label>
        <input id="lookup" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Look up a new chemical: name or CAS number"
          className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2" />
        <button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Searching PubChem…' : 'Search PubChem'}</button>
      </form>
      {lookupError && <p role="alert" className="mt-2 text-sm text-red-700">{lookupError}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="filter">Search the library</label>
        <input id="filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search saved chemicals (name, formula, CAS)"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2" />
        {['Import', 'Export all', 'New experiment', 'Compatibility check'].map((b) => (
          <button key={b} disabled title="Coming in a later phase" className="rounded border border-slate-300 bg-white px-4 py-2 opacity-50">{b}</button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {cards === null && !error && <p className="mt-6 text-slate-500">Loading…</p>}
      {cards && shown.length === 0 && (
        <div className="mt-8 rounded-lg border-2 border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold">{cards.length ? 'No chemical matches your search' : 'Your library is empty'}</h2>
          <p className="mt-1 text-slate-600">Look up a chemical above to create a card.</p>
        </div>
      )}
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {shown.map((c) => (
          <li key={c.id}>
            <button onClick={() => onOpen(c)} className="flex w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-emerald-600">
              <NfpaDiamond card={c} size={64} />
              <span>
                <span className="block font-semibold">{c.fields.name?.value}</span>
                <span className="block text-sm text-slate-600">{c.fields.formula?.value ?? '—'} · CAS {c.cas?.value ?? '—'}</span>
                <span className={`mt-1 inline-block rounded px-1.5 text-xs ${isFullyApproved(c) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {isFullyApproved(c) ? 'Approved' : 'Needs review'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
