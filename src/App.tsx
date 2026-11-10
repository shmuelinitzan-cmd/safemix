import Library from './screens/Library'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-emerald-700">SafeMix</h1>
          <span className="text-sm text-slate-500">Chemical safety cards</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Library />
      </main>
      <footer className="mx-auto max-w-5xl px-4 pb-6 text-xs text-slate-500">
        SafeMix produces draft SDS cards for education and lab organisation. It
        is not a legally valid SDS and does not replace the supplier's sheet or
        the lab safety officer.
      </footer>
    </div>
  )
}
