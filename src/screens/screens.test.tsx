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
  it('converts a boiling point given in °F, with a "converted" label', () => {
    const f = { ...acetone, fields: { ...acetone.fields, bp: { ...acetone.fields.bp!, value: '133 °F at 760 mmHg' } } }
    const h2 = renderToStaticMarkup(<CardScreen card={f} saved onSave={noop} onDelete={noop} onBack={() => {}} />)
    expect(h2).toContain('56.1 °C')
  })
  it('vapour pressure: first value only, temperature converted, full text only in the details', () => {
    expect(html).toContain('180 mmHg at 68 °F')
    expect(html).toContain('≈ 180 mmHg at 20 °C')
    expect(html).toContain('<em>(converted)</em>')
    // the second value appears only inside a details block, as the "Original text" row
    const idx = html.indexOf('270 mmHg at 86')
    expect(idx).toBeGreaterThan(-1)
    expect(html.lastIndexOf('<details', idx)).toBeGreaterThan(html.lastIndexOf('</details>', idx))
    expect(html).toContain('Original text')
  })
  it('badges use short names, with the full name on hover and in the details', () => {
    expect(html).toContain('>PubChem · HSDB</a>')
    expect(html).toContain('>PubChem · CAMEO</a>')
    expect(html).toContain('>PubChem · ICSC</a>')
    expect(html).not.toContain('Hazardous Substances Data Ba<')
    expect(html).toContain('title="PubChem · via Hazardous Substances Data Bank (HSDB)')
    expect(html).toContain('Hazardous Substances Data Bank (HSDB)</dd>')
  })
})

describe('structure picture on the card', () => {
  const html = renderToStaticMarkup(<CardScreen card={acetone} saved onSave={noop} onDelete={noop} onBack={() => {}} />)
  it('shows the picture with alt text and a PubChem badge next to name and formula', () => {
    expect(html).toContain('alt="2D structure of Acetone"')
    expect(html).toContain('src="data:image/png;base64,')
    expect(html).toMatch(/href="https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/rest\/pug\/compound\/cid\/180\/PNG\?image_size=1000x1000"[^>]*>PubChem<\/a>/)
    expect(html.indexOf('<img')).toBeLessThan(html.indexOf('<h2'))
    expect(html).toContain('C3H6O')
  })
  it('shows no picture on an inorganic card', () => {
    const naoh = cards.find((c) => c.cas?.value === '1310-73-2')!
    expect(renderToStaticMarkup(<CardScreen card={naoh} saved onSave={noop} onDelete={noop} onBack={() => {}} />)).not.toContain('<img')
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
