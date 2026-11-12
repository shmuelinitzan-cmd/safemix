import { describe, expect, it } from 'vitest'
import demo from '../data/demo-cards.json'
import type { ChemicalCard } from '../types/card.ts'
import { buildExperimentPdf, buildExperimentPdfDoc, DISCLAIMER, pdfSafe } from './pdf.ts'

const cards = demo as unknown as ChemicalCard[]

describe('pdfSafe', () => {
  it('keeps degree signs, superscripts and dashes', () => expect(pdfSafe('56 °C, g/cm³ – x')).toBe('56 °C, g/cm³ – x'))
  it('replaces ≈ with ~ (no space, so it never ends a line alone)', () => expect(pdfSafe('(≈ 20 °C)')).toBe('(~20 °C)'))
  it('replaces characters the PDF font cannot draw', () => expect(pdfSafe('α-pinene')).toBe('?-pinene'))
})

describe('experiment PDF', () => {
  it('is a landscape A4 PDF with a table page and sources pages', async () => {
    const doc = await buildExperimentPdfDoc('Titration', cards, '2026-11-11')
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(doc.internal.pageSize.getHeight())
    expect(Math.round(doc.internal.pageSize.getWidth())).toBe(297)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
  })
  it('starts with the PDF signature', async () => {
    const bytes = new Uint8Array(await buildExperimentPdf('T', cards, '2026-11-11'))
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  })
  it('carries the banner, the footnotes, the sources heading and the links', async () => {
    const text = new TextDecoder('latin1').decode(await buildExperimentPdf('T', cards.slice(0, 2), '2026-11-11'))
    expect(text).toContain(DISCLAIMER)
    expect(text).toContain('Sources')
    expect(text).toContain('No data from approved sources')
    expect(text).toContain('https://pubchem.ncbi.nlm.nih.gov/compound/180')
    expect(text).toContain('Corrected after manual check against CRC Handbook 107th ed.')
  })
  it('lists the sources on pages after the table', async () => {
    const one = await buildExperimentPdfDoc('T', cards.slice(0, 1), '2026-11-11')
    const five = await buildExperimentPdfDoc('T', cards, '2026-11-11')
    expect(five.getNumberOfPages()).toBeGreaterThan(one.getNumberOfPages())
  })
})
