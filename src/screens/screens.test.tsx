import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CardScreen from './CardScreen.tsx'
import Library from './Library.tsx'
import ExperimentScreen from './ExperimentScreen.tsx'
import type { Experiment } from '../types/experiment.ts'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'

const cards = demo as unknown as ChemicalCard[]
const acetone = cards.find((c) => c.cas?.value === '67-64-1')!
const noop = async () => {}

describe('card screen', () => {
  const html = renderToStaticMarkup(<CardScreen card={acetone} saved onSave={noop} onDelete={noop} onBack={() => {}} />)
  it('shows the education banner', () => expect(html).toContain('Draft for educational use. Verify against the supplier SDS before use.'))
  it('shows the corrected acetone density and what PubChem had', () => {
    expect(html).toContain('0.7902 g/mL at 20 °C')
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
    expect(html).toContain('180 mmHg at 20 °C')
    expect(html).toContain('<em>converted from 68 °F</em>')
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

const libProps = {
  experiments: [] as Experiment[], onOpen: () => {}, onLookup: noop, onNewExperiment: () => {}, onOpenExperiment: () => {},
  onExportAll: () => {}, onImportFile: async () => { throw new Error('unused') }, onApplyImport: noop,
}

describe('library screen', () => {
  it('lists the demo cards', () => {
    const html = renderToStaticMarkup(<Library cards={cards} {...libProps} />)
    for (const n of ['Acetone', 'Ethanol', 'Acetic acid (glacial)', 'Sodium Hydroxide', 'Hydrogen Peroxide']) expect(html).toContain(n)
  })
  it('shows the empty state', () => {
    expect(renderToStaticMarkup(<Library cards={[]} {...libProps} />)).toContain('Your library is empty')
  })
  it('has the intro: one headline and the three points', () => {
    const html = renderToStaticMarkup(<Library cards={cards} {...libProps} />)
    expect(html).toContain('Search a chemical, get a cited lab safety card')
    for (const t of ['Every value cites its source', 'Demo values verified against the CRC Handbook', 'No AI-generated data']) expect(html).toContain(t)
    expect(html.match(/<h2/g)).toHaveLength(1) // just the headline; the library itself has no other heading here
  })
  it('enables New experiment, Import and Export all; Compatibility check waits for phase 2', () => {
    const html = renderToStaticMarkup(<Library cards={cards} {...libProps} />)
    expect(html).toMatch(/<button[^>]*>New experiment<\/button>/)
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>New experiment/)
    expect(html).toMatch(/<button disabled=""[^>]*>Compatibility check<\/button>/)
  })
  it('lists saved experiments', () => {
    const e: Experiment = { id: 'exp-1', name: 'Titration lab', card_ids: ['a', 'b'], created_at: '2026-11-11', updated_at: '2026-11-11' }
    const html = renderToStaticMarkup(<Library cards={cards} {...libProps} experiments={[e]} />)
    expect(html).toContain('Titration lab')
    expect(html).toContain('2 chemicals')
  })
})

describe('experiment screen', () => {
  const exp: Experiment = { id: 'exp-1', name: 'Titration lab', card_ids: ['cas-64-19-7', 'cas-1310-73-2'], created_at: '2026-11-11', updated_at: '2026-11-11' }
  const html = renderToStaticMarkup(<ExperimentScreen experiment={exp} saved library={cards} onSave={noop} onDelete={noop} onBack={() => {}} />)
  it('shows one row per chosen chemical, in the chosen order', () => {
    expect(html.match(/<tbody>[\s\S]*<\/tbody>/)![0].match(/<tr /g)).toHaveLength(2)
    expect(html.indexOf('Acetic acid (glacial)')).toBeLessThan(html.indexOf('Sodium Hydroxide', html.indexOf('<tbody>')))
  })
  it('uses the lab form columns', () => {
    for (const c of ['Chemical name', 'Formula', 'MW (g/mol)', 'BP / MP (°C)', 'Density (g/mL)', 'Vapour pressure (mmHg)', 'Waste container', 'NFPA 704', 'Exposure hazards', 'Fire', 'Health', 'Reactivity', 'Special', 'Eyes', 'Skin', 'Inhalation', 'Ingestion'])
      expect(html).toContain(`>${c}</th>`)
  })
  it('has the banner, the legend and the export buttons', () => {
    expect(html).toContain('Draft for educational use. Verify against the supplier SDS before use.')
    expect(html).toContain('† = Rule-based suggestion')
    expect(html).toContain('Export PDF')
    expect(html).toContain('Export CSV')
  })
  it('ticks the chosen chemicals in the picker', () => {
    expect(html.match(/checked=""/g)).toHaveLength(2)
  })
  it('disables the exports when the table is empty', () => {
    const empty = renderToStaticMarkup(<ExperimentScreen experiment={{ ...exp, card_ids: [] }} saved={false} library={cards} onSave={noop} onDelete={noop} onBack={() => {}} />)
    expect(empty).toMatch(/<button disabled=""[^>]*>Export PDF/)
    expect(empty).toContain('Tick chemicals above to add them as rows.')
  })
  it('drops chemicals that were deleted from the library and says so', () => {
    const gone = renderToStaticMarkup(<ExperimentScreen experiment={{ ...exp, card_ids: ['cas-64-19-7', 'cas-deleted'] }} saved library={cards} onSave={noop} onDelete={noop} onBack={() => {}} />)
    expect(gone).toContain('1 chemical is no longer in the library')
  })
})
