export default function Library() {
  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search by name or CAS number"
          aria-label="Search the library"
          className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2"
          disabled
        />
        <button className="rounded bg-emerald-700 px-4 py-2 text-white opacity-50" disabled>
          New card
        </button>
        <button className="rounded border border-slate-300 bg-white px-4 py-2 opacity-50" disabled>
          Import
        </button>
        <button className="rounded border border-slate-300 bg-white px-4 py-2 opacity-50" disabled>
          Export all
        </button>
        <button className="rounded border border-slate-300 bg-white px-4 py-2 opacity-50" disabled>
          Compatibility check
        </button>
      </div>

      <div className="mt-8 rounded-lg border-2 border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold">Your library is empty</h2>
        <p className="mt-1 text-slate-600">
          Chemical cards will appear here. Creating cards comes in the next
          build phase.
        </p>
      </div>
    </section>
  )
}
