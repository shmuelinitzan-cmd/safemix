import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import Library from './screens/Library.tsx'
import CardScreen from './screens/CardScreen.tsx'
import ExperimentScreen from './screens/ExperimentScreen.tsx'
import { db, seedDemo } from './lib/db.ts'
import { lookup } from './lib/pubchem.ts'
import { cardFromLookup } from './lib/cards.ts'
import { attachStructure } from './lib/structure.ts'
import { exportLibrary, ImportError, MAX_IMPORT_BYTES, parseLibraryFile, planImport, type ImportPlan } from './lib/library-io.ts'
import { downloadFile } from './lib/download.ts'
import type { ChemicalCard } from './types/card.ts'
import type { Experiment } from './types/experiment.ts'

type View =
  | { type: 'library' }
  | { type: 'card'; card: ChemicalCard; saved: boolean }
  | { type: 'experiment'; experiment: Experiment; saved: boolean }

const STORAGE_ERROR = 'This browser is blocking local storage, so cards cannot be saved here.'
const newId = () => `exp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export default function App() {
  const [cards, setCards] = useState<ChemicalCard[] | null>(null)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [error, setError] = useState('')
  const [view, setView] = useState<View>({ type: 'library' })

  useEffect(() => {
    const subs: { unsubscribe(): void }[] = []
    seedDemo()
      .catch(() => setError(STORAGE_ERROR))
      .finally(() => {
        subs.push(liveQuery(() => db.cards.toArray()).subscribe({ next: setCards, error: () => { setError(STORAGE_ERROR); setCards([]) } }))
        subs.push(liveQuery(() => db.experiments.toArray()).subscribe({ next: setExperiments, error: () => {} }))
      })
    return () => subs.forEach((s) => s.unsubscribe())
  }, [])

  const lookupChemical = async (q: string) => {
    const draft = await attachStructure(cardFromLookup(await lookup(q)))
    const existing = cards?.find((c) => c.id === draft.id)
    setView(existing ? { type: 'card', card: existing, saved: true } : { type: 'card', card: draft, saved: false })
  }

  const newExperiment = () => {
    const now = new Date().toISOString().slice(0, 10)
    setView({ type: 'experiment', saved: false, experiment: { id: newId(), name: 'New experiment', card_ids: [], created_at: now, updated_at: now } })
  }

  const exportAll = () =>
    downloadFile(`safemix-library-${new Date().toISOString().slice(0, 10)}.json`, exportLibrary(cards ?? [], experiments), 'application/json')

  const importFile = async (file: File): Promise<ImportPlan> => {
    if (file.size > MAX_IMPORT_BYTES) throw new ImportError('This file is too large to be a SafeMix library.')
    return planImport(parseLibraryFile(await file.text()), { cards: cards ?? [], experiments })
  }
  const applyImport = async (plan: ImportPlan, replace: boolean) => {
    await db.cards.bulkPut(replace ? [...plan.newCards, ...plan.existingCards] : plan.newCards)
    await db.experiments.bulkPut(replace ? [...plan.newExperiments, ...plan.existingExperiments] : plan.newExperiments)
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-3xl font-bold text-emerald-700">SafeMix</h1>
          <span className="text-sm text-slate-500">Chemical safety cards</span>
        </div>
      </header>
      <main className={`mx-auto px-4 py-6 ${view.type === 'experiment' ? 'max-w-7xl' : 'max-w-5xl'}`}>
        {view.type === 'library' && (
          <Library cards={cards} experiments={experiments} error={error} onLookup={lookupChemical}
            onOpen={(card) => setView({ type: 'card', card, saved: true })}
            onNewExperiment={newExperiment}
            onOpenExperiment={(experiment) => setView({ type: 'experiment', experiment, saved: true })}
            onExportAll={exportAll} onImportFile={importFile} onApplyImport={applyImport} />
        )}
        {view.type === 'card' && (
          <CardScreen key={view.card.id} card={view.card} saved={view.saved}
            onSave={async (c) => { await db.cards.put(c); setView({ type: 'card', card: c, saved: true }) }}
            onDelete={(id) => db.cards.delete(id)}
            onBack={() => setView({ type: 'library' })}
            onOpenDraft={(c) => {
              const existing = cards?.find((x) => x.id === c.id)
              setView(existing ? { type: 'card', card: existing, saved: true } : { type: 'card', card: c, saved: false })
            }} />
        )}
        {view.type === 'experiment' && (
          <ExperimentScreen key={view.experiment.id} experiment={view.experiment} saved={view.saved} library={cards ?? []}
            onSave={async (e) => { await db.experiments.put(e) }}
            onDelete={(id) => db.experiments.delete(id)}
            onBack={() => setView({ type: 'library' })} />
        )}
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-6 text-xs text-slate-500">
        SafeMix produces draft safety cards for education and lab organisation. It is not a legally valid SDS and does not replace the supplier's sheet or the lab safety officer.
      </footer>
    </div>
  )
}
