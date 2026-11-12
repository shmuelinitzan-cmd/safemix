import { useState } from 'react'

const KEY = 'safemix-intro-hidden'
const read = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }

// A short welcome for first-time visitors. It can be hidden, and stays hidden in this browser.
export default function Intro() {
  const [hidden, setHidden] = useState(read)
  if (hidden) return null
  const hide = () => { try { localStorage.setItem(KEY, '1') } catch { /* private window: it just comes back next time */ } setHidden(true) }
  return (
    <section aria-label="About SafeMix" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-emerald-900">Search a chemical, get a cited lab safety card</h2>
        <button onClick={hide} className="shrink-0 text-sm text-emerald-800 underline" aria-label="Hide this introduction">Hide</button>
      </div>
      <ul className="mt-1 flex flex-col gap-x-6 gap-y-0.5 text-sm text-slate-700 sm:flex-row sm:flex-wrap">
        {['Every value cites its source', 'Demo values verified against the CRC Handbook', 'No AI-generated data'].map((t) => (
          <li key={t} className="flex items-center gap-1.5"><span aria-hidden className="font-bold text-emerald-700">✓</span>{t}</li>
        ))}
      </ul>
    </section>
  )
}
