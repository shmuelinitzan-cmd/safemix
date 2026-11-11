import { useState } from 'react'
import type { ChemicalCard, FieldKey } from '../types/card.ts'
import { approveCard, editField, isFullyApproved } from '../lib/cards.ts'
import FieldRow from '../components/FieldRow.tsx'
import NfpaDiamond from '../components/NfpaDiamond.tsx'

const BLOCKS: { title: string; keys: FieldKey[] }[] = [
  { title: 'Identity and properties', keys: ['name', 'formula', 'mw', 'bp', 'mp', 'density', 'vapor_pressure'] },
  { title: 'Waste container', keys: ['waste_container'] },
  { title: 'NFPA 704', keys: ['nfpa_fire', 'nfpa_health', 'nfpa_reactivity', 'nfpa_special'] },
  { title: 'Exposure hazards by route', keys: ['exp_eyes', 'exp_skin', 'exp_inhalation', 'exp_ingestion'] },
]

interface Props {
  card: ChemicalCard
  saved: boolean
  onSave: (card: ChemicalCard) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onBack: () => void
}

export default function CardScreen({ card: initial, saved, onSave, onDelete, onBack }: Props) {
  const [card, setCard] = useState(initial)
  const [msg, setMsg] = useState('')
  const approved = isFullyApproved(card)
  const edit = (k: FieldKey) => (v: string) => { setCard(editField(card, k, v)); setMsg('') }

  const save = async () => {
    const a = approveCard(card)
    try { await onSave(a); setCard(a); setMsg('Approved and saved on this computer.') }
    catch { setMsg('Could not save. Your browser may be blocking local storage (private window?).') }
  }

  return (
    <div>
      <button onClick={onBack} className="mb-3 text-sm text-emerald-700 underline">← Back to library</button>
      <div role="note" className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Draft for educational use. Verify against the supplier SDS before use.
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {card.structure && (
          <figure className="m-0 text-center">
            <img src={card.structure.data_url} width={120} height={120} alt={`2D structure of ${card.fields.name?.value ?? 'the chemical'}`}
              className="rounded border border-slate-200 bg-white" />
            <figcaption className="mt-1">
              <a href={card.structure.source_url} target="_blank" rel="noreferrer"
                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-200"
                title={`retrieved ${card.structure.retrieved_at}`}>PubChem</a>
            </figcaption>
          </figure>
        )}
        <div>
          <h2 className="text-2xl font-bold">{card.fields.name?.value ?? 'Unnamed chemical'}</h2>
          <p className="text-slate-600">{card.fields.formula?.value}</p>
        </div>
      </div>
      <p className="mb-4 mt-2 text-sm text-slate-500">
        {saved && approved ? 'Approved and saved' : saved ? 'Saved, with changes to approve' : 'Not saved yet. Check every value, then approve.'}
      </p>
      <div className="space-y-4">
        {BLOCKS.map((b) => (
          <section key={b.title} className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-1 font-semibold text-emerald-800">{b.title}</h3>
            {b.title === 'NFPA 704' && <div className="mb-2"><NfpaDiamond card={card} /></div>}
            {b.keys.map((k) => <FieldRow key={k} k={k} field={card.fields[k]} onEdit={edit(k)} />)}
          </section>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saved && approved} className="rounded bg-emerald-700 px-5 py-2 font-medium text-white disabled:opacity-40">
          Approve and save
        </button>
        {saved && (
          <button onClick={async () => { if (confirm('Delete this card from this computer?')) { await onDelete(card.id); onBack() } }}
            className="rounded border border-red-300 px-4 py-2 text-red-700">Delete card</button>
        )}
        {msg && <span role="status" className="text-sm text-slate-700">{msg}</span>}
      </div>
    </div>
  )
}
