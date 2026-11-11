import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'
import { attachStructure, fetchStructure, isOrganic } from './structure.ts'
import { SafeMixDB, seedDemo } from './db.ts'
import { approveCard, cardFromLookup } from './cards.ts'

const cards = demo as unknown as ChemicalCard[]
const byCas = (cas: string) => cards.find((c) => c.cas?.value === cas)!
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

afterEach(() => vi.unstubAllGlobals())

describe('which cards get a structure', () => {
  it('organic = formula contains carbon', () => {
    expect(cards.filter(isOrganic).map((c) => c.fields.name?.value).sort()).toEqual(['Acetic acid (glacial)', 'Acetone', 'Ethanol'])
  })
  it('the 3 organic demo cards have a PubChem picture, the 2 inorganic ones do not', () => {
    for (const c of cards) expect(!!c.structure).toBe(isOrganic(c))
    for (const c of cards.filter(isOrganic)) {
      expect(c.structure!.data_url.startsWith('data:image/png;base64,')).toBe(true)
      expect(c.structure!.source).toBe('pubchem')
      expect(c.structure!.source_url).toMatch(/^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/rest\/pug\/compound\/cid\/\d+\/PNG$/)
    }
  })
})

describe('fetching', () => {
  it('uses only the PubChem PNG endpoint, by CID', async () => {
    const fetchMock = vi.fn(async () => new Response(PNG, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const s = await fetchStructure(180, '2026-11-11')
    expect(fetchMock).toHaveBeenCalledWith('https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/180/PNG')
    expect(s).toMatchObject({ source: 'pubchem', status: 'pending', retrieved_at: '2026-11-11' })
    expect(s!.data_url).toBe(`data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`)
  })
  it('refuses something that is not a PNG', async () => {
    vi.stubGlobal('fetch', async () => new Response('<html>error</html>', { status: 200 }))
    expect(await fetchStructure(180)).toBeUndefined()
  })
  it('returns nothing on HTTP errors and network failures', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    expect(await fetchStructure(180)).toBeUndefined()
    vi.stubGlobal('fetch', async () => { throw new TypeError('offline') })
    expect(await fetchStructure(180)).toBeUndefined()
  })
  it('does not fetch for inorganic cards, and does not refetch an existing picture', async () => {
    const fetchMock = vi.fn(async () => new Response(PNG))
    vi.stubGlobal('fetch', fetchMock)
    await attachStructure(byCas('1310-73-2'))
    await attachStructure(byCas('67-64-1'))
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('a failed download leaves the card usable without a picture', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 500 }))
    const { structure: _drop, ...rest } = byCas('67-64-1')
    void _drop
    const c = await attachStructure(rest as ChemicalCard)
    expect(c.structure).toBeUndefined()
    expect(c.fields.name?.value).toBe('Acetone')
  })
})

describe('saving', () => {
  it('approving a drafted card approves its picture too', async () => {
    vi.stubGlobal('fetch', async () => new Response(PNG))
    const draft = await attachStructure({ ...cardFromLookup({ cid: 180, title: 'Acetone', fields: byCas('67-64-1').fields, missing: [] }), pubchem_cid: 180 })
    expect(draft.structure?.status).toBe('pending')
    expect(approveCard(draft).structure?.status).toBe('approved')
  })
  it('the picture is stored in IndexedDB with the card and read back without any network', async () => {
    vi.stubGlobal('fetch', async () => { throw new Error('network must not be used') })
    const d = new SafeMixDB('test-structure')
    await seedDemo(d)
    const back = await d.cards.get('cas-67-64-1')
    expect(back?.structure?.data_url).toBe(byCas('67-64-1').structure!.data_url)
    expect((await d.cards.get('cas-1310-73-2'))?.structure).toBeUndefined()
  })
})
