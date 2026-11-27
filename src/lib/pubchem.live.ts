// Stage 3, part C4: opt-in check against the REAL PubChem, to notice changes in its format.
// Run by hand with `npm run test:live`. It is not part of `npm test` or the deploy.
// No chemical values are written here: it only checks that the same parts of each record can
// still be read. Failures start with NETWORK (could not get an answer) or FORMAT (the answer
// arrived but no longer reads as expected).
import { beforeAll, describe, expect, it } from 'vitest'
import { fetchCid, fetchRecord, parseRecord, type PubChemResult } from './pubchem.ts'

// What each saved record yields: the live record must still yield at least these fields.
const saved = import.meta.glob<{ Record: unknown }>('./__fixtures__/*.json', { import: 'default', eager: true })
const CHEMICALS = [
  ['acetone', 'acetone'], ['ethanol', 'ethanol'], ['glacial acetic acid', 'acetic-acid'],
  ['sodium hydroxide', 'sodium-hydroxide'], ['hydrogen peroxide', 'hydrogen-peroxide'], ['iodoform', 'iodoform'],
]

async function request<T>(what: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // a failed connection, an HTTP error status, or a reply that is not JSON (e.g. a "busy" page)
    const network = error instanceof TypeError || error instanceof SyntaxError || /\(HTTP \d+\)|HTTP \d+\./.test(message)
    throw new Error(`${network ? 'NETWORK' : 'FORMAT'}: ${what} failed: ${message}`)
  }
}
const pause = () => new Promise((resolve) => setTimeout(resolve, 1000)) // one request at a time, gently

describe.each(CHEMICALS)('live PubChem: %s', (query, file) => {
  const reference = parseRecord(saved[`./__fixtures__/${file}.json`].Record, '2026-01-01')
  let live: PubChemResult
  beforeAll(async () => {
    await pause()
    const cid = await request('name search', () => fetchCid(query))
    await pause()
    const record = await request('record download', () => fetchRecord(cid))
    live = await request('reading the record', async () => parseRecord(record, '2026-01-01'))
  }, 120_000)

  it('the name still leads to the same compound', () => expect(live.cid, 'FORMAT: different CID').toBe(reference.cid))
  it('the same fields can still be read', () => {
    const lost = Object.keys(reference.fields).filter((k) => !(k in live.fields))
    expect(lost, 'FORMAT: fields that can no longer be read').toEqual([])
    expect(live.cas, 'FORMAT: no CAS number').toBeDefined()
  })
  it('every value cites PubChem (the waste suggestion cites the app rule)', () => {
    for (const [key, f] of Object.entries(live.fields)) {
      expect(f!.source, key).toBe(key === 'waste_container' ? 'app' : 'pubchem')
      expect(f!.source_url, key).toMatch(key === 'waste_container' ? /^https:\/\// : /^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\//)
    }
  })
  it('no NFPA entry or GHS line has become unreadable', () => {
    const unread = Object.entries(live.fields).filter(([, f]) => f!.unverified || f!.note?.includes('could not read')).map(([k]) => k)
    expect(unread, 'FORMAT: entries SafeMix could not read').toEqual([])
  })
})
