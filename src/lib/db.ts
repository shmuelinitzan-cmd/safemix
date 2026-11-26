// Browser storage (IndexedDB via Dexie). Cards stay on this computer; no server.
import Dexie, { type Table } from 'dexie'
import type { ChemicalCard } from '../types/card.ts'
import type { Experiment } from '../types/experiment.ts'
import demoCards from '../data/demo-cards.json'

class SafeMixDB extends Dexie {
  cards!: Table<ChemicalCard, string>
  meta!: Table<{ key: string; value: string }, string>
  experiments!: Table<Experiment, string>
  constructor(name = 'safemix') {
    super(name)
    this.version(1).stores({ cards: 'id', meta: 'key' })
    // v2 adds saved experiments; existing cards are kept.
    this.version(2).stores({ cards: 'id', meta: 'key', experiments: 'id' })
  }
}

export const db = new SafeMixDB()

// Demo cards are added once, on first start. Deleting one later keeps it deleted.
export async function seedDemo(target: SafeMixDB = db, cards: ChemicalCard[] = demoCards as ChemicalCard[]) {
  await markStoredDemoCards(target, cards)
  if (await target.meta.get('demo_seeded')) return false
  await target.cards.bulkPut(cards)
  await target.meta.put({ key: 'demo_seeded', value: new Date().toISOString() })
  return true
}

// Browsers that loaded the demo cards earlier get the "not verified" marks too. Only the mark
// is added: stored values are not touched, and deleted cards are not brought back.
async function markStoredDemoCards(target: SafeMixDB, cards: ChemicalCard[]) {
  for (const demo of cards) {
    if (!demo.not_verified) continue
    await target.cards.where('id').equals(demo.id).modify((c) => { c.not_verified = demo.not_verified })
  }
}

export { SafeMixDB }
