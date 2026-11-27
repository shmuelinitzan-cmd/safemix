// Experiment table -> print-ready PDF: A4 landscape, the lab form's columns, and the
// sources for every value on the last pages. jsPDF is loaded only when the user exports.
import type { CellInput } from 'jspdf-autotable'
import type { ChemicalCard } from '../types/card.ts'
import { COLUMNS, cellsFor, FOOTNOTES, ghsBesideNfpa, ghsInsteadOfNfpa, NFPA_IDS, sourceRows } from './table.ts'
import { NOT_VERIFIED } from './provenance.ts'

export const DISCLAIMER = 'Draft for educational use. Verify against the supplier SDS before use.'

// The built-in PDF font draws Latin-1 plus a few Windows-1252 symbols. Anything else would
// print as garbage, so it is replaced: "≈" -> "~", the rest -> "?".
const WIN1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
export function pdfSafe(s: string): string {
  return [...s.replace(/≈\s*/g, '~').replace(/[−]/g, '-').replace(/[   ]/g, ' ')]
    .map((ch) => (ch === '\n' || ch.charCodeAt(0) <= 0xff || WIN1252_EXTRA.includes(ch) ? ch : '?'))
    .join('')
}

// The NFPA columns are too narrow for the words, so in the PDF they get a "*" instead.
export const NFPA_STAR_NOTE = `* in the NFPA 704 columns = ${NOT_VERIFIED}.`
export const PDF_INTRO = `Sources are listed on the last pages. Values marked "${NOT_VERIFIED}" (* in the NFPA columns) were not verified.`
export function pdfCell(columnId: string, text: string): string {
  const mark = ` (${NOT_VERIFIED})`
  return NFPA_IDS.includes(columnId) && text.endsWith(mark) ? `${text.slice(0, -mark.length)}*` : text
}

const hexToRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

export async function buildExperimentPdfDoc(name: string, cards: ChemicalCard[], date: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 8

  doc.setFont('helvetica', 'bold').setFontSize(14)
  doc.text(pdfSafe(`Experiment: ${name}`), M, 12)
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90)
  doc.text(pdfSafe(`SafeMix, ${date}. ${cards.length} chemical${cards.length === 1 ? '' : 's'}. ${PDF_INTRO}`), M, 17)
  doc.setTextColor(0)

  // ---- the lab table ----
  const groups = [...new Set(COLUMNS.map((c) => c.group).filter(Boolean))] as string[]
  const head = [
    COLUMNS.filter((c) => !c.group || c.id === COLUMNS.find((x) => x.group === c.group)!.id).map((c) =>
      c.group ? { content: c.group, colSpan: COLUMNS.filter((x) => x.group === c.group).length, styles: { halign: 'center' as const } }
              : { content: pdfSafe(c.label), rowSpan: 2 }),
    COLUMNS.filter((c) => c.group).map((c) => ({ content: c.label, styles: { halign: 'center' as const } })),
  ]
  const ghsStyles = { halign: 'left' as const, fontStyle: 'normal' as const, fontSize: 5.5, fillColor: [255, 247, 237] as [number, number, number] }
  const body = cards.flatMap((card): CellInput[][] => {
    const cells = cellsFor(card)
    for (const id of NFPA_IDS) cells[id] = pdfCell(id, cells[id])
    const ghs = ghsInsteadOfNfpa(card)
    const below = ghsBesideNfpa(card)
    // an NFPA rating that could not be read: a second line with the GHS cell under the NFPA columns
    if (below) return [
      COLUMNS.map((c) => (NFPA_IDS.includes(c.id) ? pdfSafe(cells[c.id]) : { content: pdfSafe(cells[c.id]), rowSpan: 2 })),
      [{ content: pdfSafe(below), colSpan: NFPA_IDS.length, styles: ghsStyles }],
    ]
    if (!ghs) return [COLUMNS.map((c) => pdfSafe(cells[c.id]))]
    // no NFPA rating: one merged cell with the GHS statements across the four NFPA columns
    return [COLUMNS.filter((c) => !NFPA_IDS.includes(c.id) || c.id === 'fire').map((c) => c.id === 'fire'
      ? { content: pdfSafe(ghs), colSpan: NFPA_IDS.length, styles: ghsStyles }
      : pdfSafe(cells[c.id]))]
  })
  const widths: Record<string, number> = { name: 22, formula: 15, mw: 12, bpmp: 25, density: 20, vp: 25, waste: 17, fire: 10, health: 12, reactivity: 16, special: 12 }

  autoTable(doc, {
    head, body,
    startY: 21,
    margin: { left: M, right: M, top: 14, bottom: 14 },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6.5, cellPadding: 1.2, overflow: 'linebreak', valign: 'top', lineColor: [150, 150, 150], lineWidth: 0.15 },
    headStyles: { fillColor: [6, 95, 70], textColor: 255, fontSize: 7, valign: 'middle', halign: 'center' },
    columnStyles: Object.fromEntries(COLUMNS.map((c, i) => [i, {
      ...(widths[c.id] ? { cellWidth: widths[c.id] } : {}),
      ...(c.id === 'fire' || c.id === 'health' || c.id === 'reactivity' || c.id === 'special' ? { halign: 'center', fontStyle: 'bold' } : {}),
    }])),
    didParseCell: (d) => {
      // colour the NFPA sub-headers like the diamond
      if (d.section === 'head' && d.row.index === 1) {
        d.cell.styles.fontSize = 6.5
        const col = COLUMNS.filter((c) => c.group)[d.column.index - COLUMNS.findIndex((c) => c.group)]
        if (col?.fill) {
          d.cell.styles.fillColor = hexToRgb(col.fill)
          d.cell.styles.textColor = col.group === 'NFPA 704' && (col.id === 'fire' || col.id === 'health') ? 255 : 0
        }
        if (col?.group === 'Exposure hazards') d.cell.styles.fillColor = [6, 95, 70]
      }
    },
  })

  // legend under the table (new page if it would not fit)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y: number = (doc as any).lastAutoTable.finalY + 5
  const notes = [...FOOTNOTES, NFPA_STAR_NOTE]
  // each note takes 3.6 mm; the last one must stay clear of the page footer
  if (y > doc.internal.pageSize.getHeight() - 10 - notes.length * 3.6) { doc.addPage(); y = 14 }
  doc.setFontSize(7).setTextColor(60)
  for (const note of notes) { doc.text(pdfSafe(note), M, y); y += 3.6 }
  doc.setTextColor(0)
  void groups

  // ---- sources pages ----
  doc.addPage()
  doc.setFont('helvetica', 'bold').setFontSize(13)
  doc.text('Sources', M, 12)
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90)
  doc.text('Every value in the table, as stored (original units), with where it came from. Links open the source page.', M, 17)
  doc.setTextColor(0)
  const rows = sourceRows(cards)
  autoTable(doc, {
    startY: 21,
    margin: { left: M, right: M, top: 14, bottom: 14 },
    head: [['Chemical', 'Field', 'Value (as stored)', 'Source', 'Details', 'Retrieved', 'Link']],
    body: rows.map((r) => [r.chemical, r.field, r.value, r.source, r.detail, r.retrieved, r.url].map(pdfSafe)),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 6, cellPadding: 1, overflow: 'linebreak', valign: 'top', lineColor: [200, 200, 200], lineWidth: 0.1 },
    headStyles: { fillColor: [6, 95, 70], textColor: 255 },
    columnStyles: { 0: { cellWidth: 26 }, 1: { cellWidth: 25 }, 2: { cellWidth: 42 }, 3: { cellWidth: 40 }, 4: { cellWidth: 72 }, 5: { cellWidth: 15 }, 6: { cellWidth: 61 } },
    didDrawCell: (d) => {
      // the row's own content tells us the link (the row number counts the header row too)
      const url = d.section === 'body' && d.column.index === 6 ? String((d.row.raw as unknown[])[6] ?? '') : ''
      if (/^https:\/\//.test(url)) doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url })
    },
  })

  // ---- footer on every page ----
  const pages = doc.getNumberOfPages()
  const H = doc.internal.pageSize.getHeight()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(110)
    doc.text(DISCLAIMER, M, H - 6)
    doc.text(`SafeMix. Page ${p} of ${pages}`, W - M, H - 6, { align: 'right' })
  }
  return doc
}

export async function buildExperimentPdf(name: string, cards: ChemicalCard[], date: string): Promise<ArrayBuffer> {
  return (await buildExperimentPdfDoc(name, cards, date)).output('arraybuffer')
}
