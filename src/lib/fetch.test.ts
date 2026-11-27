// Stage 1, part C1: retrieval from approved sources, with a fake network. Nothing here
// contacts PubChem. The records are placeholders ("T", CID 1), not chemical data.
//
// `it.fails` = the correct behaviour the app does not have yet (see units.test.ts).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchCid, fetchRecord, lookup } from './pubchem.ts'
import { attachStructure } from './structure.ts'
import { cardFromLookup } from './cards.ts'

const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug'
const VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view'
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const RECORD = {
  RecordNumber: 1, RecordTitle: 'T', Reference: [],
  Section: [{ TOCHeading: 'Molecular Formula', Information: [{ ReferenceNumber: 1, Value: { StringWithMarkup: [{ String: 'C' }] } }] }],
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const cids = (...list: number[]) => json({ IdentifierList: { CID: list } })

type Answer = () => Response
// A fake PubChem: one answer per endpoint, and a log of every URL that was requested.
function fakeNetwork(answers: { cid?: Answer; record?: Answer; png?: Answer } = {}) {
  const mock = vi.fn(async (url: string | URL | Request) => {
    const u = String(url)
    if (u.includes('/cids/JSON')) return (answers.cid ?? (() => cids(1)))()
    if (u.startsWith(VIEW)) return (answers.record ?? (() => json({ Record: RECORD })))()
    if (u.includes('/PNG')) return (answers.png ?? (() => new Response(PNG)))()
    throw new Error(`unexpected request: ${u}`)
  })
  vi.stubGlobal('fetch', mock)
  return { mock, urls: () => mock.mock.calls.map((c) => String(c[0])) }
}

afterEach(() => vi.unstubAllGlobals())

describe('request order and URLs', () => {
  it('asks for the CID first, then for that record', async () => {
    const net = fakeNetwork({ cid: () => cids(1) })
    const r = await lookup('abc', '2026-01-01')
    expect(net.urls()).toEqual([`${PUG}/compound/name/abc/cids/JSON`, `${VIEW}/data/compound/1/JSON`])
    expect(r.cid).toBe(1)
    expect(r.fields.name).toMatchObject({ value: 'T', source: 'pubchem', retrieved_at: '2026-01-01', status: 'pending' })
  })

  it.each([
    ['  two words  ', 'two%20words'],
    ['a/b', 'a%2Fb'],
    ['50%', '50%25'],
    ['a?b=c', 'a%3Fb%3Dc'],
    ['a#b', 'a%23b'],
    ['α-x', '%CE%B1-x'],
    ['../x', '..%2Fx'],
  ])('encodes and trims the name "%s"', async (name, encoded) => {
    const net = fakeNetwork()
    await fetchCid(name)
    expect(net.urls()).toEqual([`${PUG}/compound/name/${encoded}/cids/JSON`])
  })
})

describe('only approved sources are contacted', () => {
  it('a full lookup with a structure picture goes only to PubChem over https', async () => {
    const net = fakeNetwork()
    const card = await attachStructure(cardFromLookup(await lookup('abc')))
    expect(card.structure).toBeDefined()
    expect(net.urls()).toHaveLength(3)
    for (const u of net.urls()) expect(new URL(u).origin).toBe('https://pubchem.ncbi.nlm.nih.gov')
  })

  // Source text of every app file (tests excluded). niosh.ts is read by a review script only.
  const sources = Object.entries(
    import.meta.glob<string>(['../**/*.ts', '../**/*.tsx', '!../**/*.test.*'], { query: '?raw', import: 'default', eager: true }),
  )
  const filesMatching = (re: RegExp) => sources.filter(([, code]) => re.test(code)).map(([path]) => path.split('/').pop()).sort()

  it('the source scan sees the app files', () => expect(sources.length).toBeGreaterThan(10))
  it('no app file imports the NIOSH reader', () => expect(filesMatching(/(from|import\()\s*['"][^'"]*niosh(\.ts)?['"]/)).toEqual([]))
  it('network calls exist only in these files', () => {
    expect(filesMatching(/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource/)).toEqual(['niosh.ts', 'pubchem.ts', 'structure.ts'])
  })
})

// The app makes a card only from a lookup that succeeds, so "rejects" means "no card".
describe('failed lookups create no card', () => {
  it('name not found (404): rejects, and no record is requested', async () => {
    const net = fakeNetwork({ cid: () => json({}, 404) })
    await expect(lookup('abc')).rejects.toThrow('PubChem could not find "abc" (HTTP 404).')
    expect(net.mock).toHaveBeenCalledTimes(1)
  })
  it.each([{}, { IdentifierList: {} }, { IdentifierList: { CID: [] } }])('no CID in the answer: %j', async (body) => {
    const net = fakeNetwork({ cid: () => json(body) })
    await expect(lookup('abc')).rejects.toThrow('PubChem returned no compound for "abc".')
    expect(net.mock).toHaveBeenCalledTimes(1)
  })
  it('the record request fails', async () => {
    fakeNetwork({ record: () => json({}, 500) })
    await expect(lookup('abc')).rejects.toThrow('PubChem record 1 failed (HTTP 500).')
  })
  it('the name answer is not JSON', async () => {
    fakeNetwork({ cid: () => new Response('<html>busy</html>') })
    await expect(lookup('abc')).rejects.toThrow()
  })
  it('the record answer is not JSON', async () => {
    fakeNetwork({ record: () => new Response('<html>busy</html>') })
    await expect(lookup('abc')).rejects.toThrow()
  })
  it('offline', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('offline') })
    await expect(lookup('abc')).rejects.toThrow('offline')
  })
  it.each([{ Record: {} }, { Record: { RecordNumber: 1 } }, { Record: { RecordTitle: 'T' } }, {}])(
    'an empty or incomplete record is rejected: %j', async (body) => {
      fakeNetwork({ record: () => json(body) })
      await expect(lookup('abc')).rejects.toThrow('PubChem returned an empty or incomplete record for CID 1.')
    })
  it('a failed picture download still gives a card, without a picture', async () => {
    fakeNetwork({ png: () => new Response('', { status: 503 }) })
    const card = await attachStructure(cardFromLookup(await lookup('abc')))
    expect(card.fields.name?.value).toBe('T')
    expect(card.structure).toBeUndefined()
  })
})

describe('error messages', () => {
  // BUG (GitHub issue, not fixed on purpose): any HTTP error reads "could not find".
  it.fails('BUG: a busy server (503) is not reported as a missing chemical', async () => {
    fakeNetwork({ cid: () => json({}, 503) })
    const error = await fetchCid('abc').then(() => undefined, (e: Error) => e)
    expect(error?.message).toContain('503')
    expect(error?.message).not.toContain('could not find')
  })
  it('a failed record request names the CID and the status', async () => {
    fakeNetwork({ record: () => json({}, 503) })
    await expect(fetchRecord(1)).rejects.toThrow('PubChem record 1 failed (HTTP 503).')
  })
})

// The two tests below record how the app behaves today. They do not say it is right.
describe('current behaviour', () => {
  it('when a name matches several compounds, the first CID is used without a warning', async () => {
    fakeNetwork({ cid: () => cids(1, 2, 3) })
    expect(await fetchCid('abc')).toBe(1)
  })
  it('requests have no timeout (no abort signal)', async () => {
    const net = fakeNetwork()
    await lookup('abc')
    for (const call of net.mock.mock.calls) expect(call).toHaveLength(1)
  })
})
