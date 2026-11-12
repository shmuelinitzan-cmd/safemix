import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'
import type { Experiment } from '../types/experiment.ts'
import { exportLibrary, ImportError, parseLibraryFile, planImport } from './library-io.ts'
import { SafeMixDB, seedDemo } from './db.ts'

const cards = demo as unknown as ChemicalCard[]
const exp: Experiment = { id: 'exp-1', name: 'Titration', card_ids: ['cas-64-19-7', 'cas-1310-73-2'], created_at: '2026-11-11', updated_at: '2026-11-11' }
const file = (mutate?: (o: any) => void) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const o = JSON.parse(exportLibrary(cards, [exp]))
  mutate?.(o)
  return JSON.stringify(o)
}

describe('round trip', () => {
  it('export then import gives back the same library', () => {
    const back = parseLibraryFile(exportLibrary(cards, [exp]))
    expect(back.cards).toEqual(JSON.parse(JSON.stringify(cards)))
    expect(back.experiments).toEqual([exp])
  })
  it('keeps the manual correction, notes and pictures', () => {
    const back = parseLibraryFile(exportLibrary(cards, [])).cards.find((c) => c.id === 'cas-67-64-1')!
    expect(back.fields.density?.source_value).toBe('0.7845 g/cu cm at 20 °C')
    expect(back.structure?.data_url.startsWith('data:image/png;base64,')).toBe(true)
  })
  it('works through the real database (export from one, import into another)', async () => {
    const a = new SafeMixDB('io-a'); await seedDemo(a); await a.experiments.put(exp)
    const text = exportLibrary(await a.cards.toArray(), await a.experiments.toArray())
    const b = new SafeMixDB('io-b')
    const parsed = parseLibraryFile(text)
    await b.cards.bulkPut(parsed.cards); await b.experiments.bulkPut(parsed.experiments)
    expect(await b.cards.count()).toBe(5)
    expect((await b.experiments.get('exp-1'))?.card_ids).toEqual(exp.card_ids)
  })
})

describe('rejects bad files with a clear message', () => {
  const bad = (text: string, msg: RegExp) => expect(() => parseLibraryFile(text)).toThrow(msg)
  it('not JSON', () => bad('hello', /not valid JSON/))
  it('wrong kind of JSON', () => bad('{"a":1}', /not a SafeMix library file/))
  it('newer version', () => bad(file((o) => { o.version = 99 }), /newer version/))
  it('cards that are not a list', () => bad(file((o) => { o.cards = {} }), /no list of cards/))
  it('a card without an id', () => bad(file((o) => { delete o.cards[0].id }), /id is missing/))
  it('a javascript: link', () => bad(file((o) => { o.cards[0].fields.name.source_url = 'javascript:alert(1)' }), /not an https/))
  it('an http: link', () => bad(file((o) => { o.cards[0].fields.name.source_url = 'http://example.com' }), /not an https/))
  it('a picture that is not a PNG data URL', () => bad(file((o) => { o.cards[0].structure.data_url = 'https://evil.example/x.png' }), /not a PNG/))
  it('an SVG data URL', () => bad(file((o) => { o.cards[0].structure.data_url = 'data:image/svg+xml;base64,PHN2Zz4=' }), /not a PNG/))
  it('an unknown source or status', () => {
    bad(file((o) => { o.cards[0].fields.name.source = 'wikipedia' }), /unknown value/)
    bad(file((o) => { o.cards[0].fields.name.status = 'maybe' }), /unknown value/)
  })
  it('a value that is not text', () => bad(file((o) => { o.cards[0].fields.name.value = { x: 1 } }), /not valid text/))
})

describe('safety of what is kept', () => {
  it('drops unknown keys and fields', () => {
    const back = parseLibraryFile(file((o) => { o.cards[0].evil = '<script>'; o.cards[0].fields.hacked = o.cards[0].fields.name; o.cards[0].fields.name.extra = 1 }))
    expect(back.cards[0]).not.toHaveProperty('evil')
    expect(back.cards[0].fields).not.toHaveProperty('hacked')
    expect(back.cards[0].fields.name).not.toHaveProperty('extra')
  })
  it('ImportError is what the screen shows', () => {
    try { parseLibraryFile('x') } catch (e) { expect(e).toBeInstanceOf(ImportError) }
  })
})

describe('import plan', () => {
  it('separates new from already-present cards and experiments', () => {
    const incoming = { cards, experiments: [exp] }
    const plan = planImport(incoming, { cards: cards.slice(0, 2), experiments: [exp] })
    expect(plan.existingCards).toHaveLength(2)
    expect(plan.newCards).toHaveLength(3)
    expect(plan.existingExperiments).toHaveLength(1)
    expect(plan.newExperiments).toHaveLength(0)
  })
})
