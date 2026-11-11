import { useEffect, useState } from 'react'
import { liveQuery } from 'dexie'
import Library from './screens/Library.tsx'
import CardScreen from './screens/CardScreen.tsx'
import { db, seedDemo } from './lib/db.ts'
import { lookup } from './lib/pubchem.ts'
import { cardFromLookup } from './lib/cards.ts'
import { attachStructure } from './lib/structure.ts'
import type { ChemicalCard } from './types/card.ts'

type View = { type: 'library' } | { type: 'card'; card: ChemicalCard; saved: boolean }

export default function App() {
  const [cards, setCards] = useState<ChemicalCard[] | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>({ type: 'library' })

  useEffect(() => {
    let sub: { unsubscribe(): void } | undefined
    seedDemo()
      .catch(() => setError('This browser is blocking local storage, so cards cannot be saved here.'))
      .finally(() => {
        sub = liveQuery(() => db.cards.toArray()).subscribe({
          next: setCards,
          error: () => { setError('This browser is blocking local storage, so cards cannot be saved here.'); setCards([]) },
        })
      })
    return () => sub?.unsubscribe()
  }, [])

  const lookupChemical = async (q: string) => {
    const draft = await attachStructure(cardFromLookup(await lookup(q)))
    const existing = cards?.find((c) => c.id === draft.id)
    setView(existing ? { type: 'card', card: existing, saved: true } : { type: 'card', card: draft, saved: false })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-3xl font-bold text-emerald-700">SafeMix</h1>
          <span className="text-sm text-slate-500">Chemical safety cards</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {view.type === 'library' ? (
          <Library cards={cards} error={error} onLookup={lookupChemical} onOpen={(card) => setView({ type: 'card', card, saved: true })} />
        ) : (
          <CardScreen key={view.card.id} card={view.card} saved={view.saved}
            onSave={async (c) => { await db.cards.put(c); setView({ type: 'card', card: c, saved: true }) }}
            onDelete={(id) => db.cards.delete(id)}
            onBack={() => setView({ type: 'library' })} />
        )}
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-6 text-xs text-slate-500">
        SafeMix produces draft safety cards for education and lab organisation. It is not a legally valid SDS and does not replace the supplier's sheet or the lab safety officer.
      </footer>
    </div>
  )
}
