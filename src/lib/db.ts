// Browser storage (IndexedDB via Dexie). Cards stay on this computer; no server.
import Dexie, { type Table } from 'dexie'
import type { ChemicalCard } from '../types/card.ts'
import demoCards from '../data/demo-cards.json'

class SafeMixDB extends Dexie {
  cards!: Table<ChemicalCard, string>
  meta!: Table<{ key: string; value: string }, string>
  constructor(name = 'safemix') {
    super(name)
    this.version(1).stores({ cards: 'id', meta: 'key' })
  }
}

export const db = new SafeMixDB()

// Demo cards are added once, on first start. Deleting one later keeps it deleted.
export async function seedDemo(target: SafeMixDB = db, cards: ChemicalCard[] = demoCards as ChemicalCard[]) {
  if (await target.meta.get('demo_seeded')) return false
  await target.cards.bulkPut(cards)
  await target.meta.put({ key: 'demo_seeded', value: new Date().toISOString() })
  return true
}

export { SafeMixDB }
