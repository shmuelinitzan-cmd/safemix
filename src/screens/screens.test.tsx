import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CardScreen from './CardScreen.tsx'
import Library from './Library.tsx'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'

const cards = demo as unknown as ChemicalCard[]
const acetone = cards.find((c) => c.cas?.value === '67-64-1')!
const noop = async () => {}

describe('card screen', () => {
  const html = renderToStaticMarkup(<CardScreen card={acetone} saved onSave={noop} onDelete={noop} onBack={() => {}} />)
  it('shows the education banner', () => expect(html).toContain('Draft for educational use. Verify against the supplier SDS before use.'))
  it('shows the corrected acetone density and what PubChem had', () => {
    expect(html).toContain('0.7902 g/cm³ at 20 °C')
    expect(html).toContain('PubChem had: 0.7845 g/cu cm at 20 °C')
    expect(html).toContain('Corrected after manual check against CRC Handbook 107th ed.')
  })
  it('shows "No data" for the empty special hazard', () => expect(html).toContain('No data from approved sources'))
  it('flags the waste container as rule-based', () => expect(html).toContain('Rule-based, confirm with lab instructions.'))
  it('has the four blocks and the approve button', () => {
    for (const t of ['Identity and properties', 'Waste container', 'NFPA 704', 'Exposure hazards by route', 'Approve and save']) expect(html).toContain(t)
  })
  it('shows a converted label only when the source value is not in °C', () => {
    const f = { ...acetone, fields: { ...acetone.fields, bp: { ...acetone.fields.bp!, value: '133 °F at 760 mmHg' } } }
    const h2 = renderToStaticMarkup(<CardScreen card={f} saved onSave={noop} onDelete={noop} onBack={() => {}} />)
    expect(h2).toContain('56.1 °C')
    expect(h2).toContain('(converted)')
    expect(html).not.toContain('(converted)')
  })
})

describe('library screen', () => {
  it('lists the demo cards', () => {
    const html = renderToStaticMarkup(<Library cards={cards} onOpen={() => {}} onLookup={noop} />)
    for (const n of ['Acetone', 'Ethanol', 'Acetic acid (glacial)', 'Sodium Hydroxide', 'Hydrogen Peroxide']) expect(html).toContain(n)
  })
  it('shows the empty state', () => {
    expect(renderToStaticMarkup(<Library cards={[]} onOpen={() => {}} onLookup={noop} />)).toContain('Your library is empty')
  })
})
