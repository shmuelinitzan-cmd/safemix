import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { SafeMixDB, seedDemo } from './db.ts'
import type { Experiment } from '../types/experiment.ts'

const exp = (id: string, ids: string[]): Experiment => ({ id, name: `Exp ${id}`, card_ids: ids, created_at: '2026-11-11', updated_at: '2026-11-11' })

describe('experiments in IndexedDB', () => {
  it('saves, reads back in order, updates and deletes', async () => {
    const d = new SafeMixDB('exp-crud')
    await d.experiments.put(exp('a', ['cas-67-64-1', 'cas-64-17-5', 'cas-64-19-7']))
    expect((await d.experiments.get('a'))?.card_ids).toEqual(['cas-67-64-1', 'cas-64-17-5', 'cas-64-19-7'])
    await d.experiments.put({ ...exp('a', ['cas-64-19-7']), name: 'Renamed' })
    expect(await d.experiments.count()).toBe(1)
    expect((await d.experiments.get('a'))?.name).toBe('Renamed')
    await d.experiments.delete('a')
    expect(await d.experiments.count()).toBe(0)
  })
  it('deleting an experiment does not delete the chemicals', async () => {
    const d = new SafeMixDB('exp-keep'); await seedDemo(d)
    await d.experiments.put(exp('a', ['cas-67-64-1']))
    await d.experiments.delete('a')
    expect(await d.cards.count()).toBe(5)
  })
  it('an existing v1 database (cards only) upgrades to v2 and keeps its cards', async () => {
    const name = 'upgrade-test'
    const old = new Dexie(name); old.version(1).stores({ cards: 'id', meta: 'key' })
    await old.table('cards').put({ id: 'cas-1', fields: {}, created_at: 'x', updated_at: 'x' })
    old.close()
    const d = new SafeMixDB(name)
    expect(await d.cards.count()).toBe(1)
    await d.experiments.put(exp('a', []))
    expect(await d.experiments.count()).toBe(1)
  })
})
