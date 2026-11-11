// NIOSH Pocket Guide page reader (https://www.cdc.gov/niosh/npg/npgdNNNN.html).
// Used for exposure hazards where PubChem has no value. The app only copies printed text.
const NPG = 'https://www.cdc.gov/niosh/npg'
const ENTITIES: Record<string, string> = { amp: '&', gt: '>', lt: '<', quot: '"', nbsp: ' ', apos: "'" }

export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?sup>/gi, '')
    .replace(/<\/(?:h6|strong)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
}

export async function fetchNpgIndex(): Promise<string> {
  const res = await fetch(`${NPG}/npgdcas.html`)
  if (!res.ok) throw new Error(`NIOSH index failed (HTTP ${res.status})`)
  return res.text()
}

export function findPageId(indexHtml: string, cas: string): string | undefined {
  return new RegExp(`<td>${cas}</td><td><a href='(npgd\\d+)\\.html'`).exec(indexHtml)?.[1]
}

// Text of one titled card on the page, e.g. "Symptoms" or "Exposure Routes".
export function cardText(html: string, title: string): string | undefined {
  const re = /<div class="card-title h6">\s*([\s\S]*?)\s*<\/div>\s*<div class="card-body">([\s\S]*?)<\/div>\s*(?:<\/div>|<div class="card-text">)/g
  for (let m; (m = re.exec(html)); ) if (htmlToText(m[1]) === title) return htmlToText(m[2])
}

export interface NioshExposure {
  page_title: string
  page_url: string
  last_reviewed?: string
  exposure_routes?: string
  symptoms?: string
  target_organs?: string
}

export async function lookupNiosh(cas: string, indexHtml?: string): Promise<NioshExposure | undefined> {
  const id = findPageId(indexHtml ?? (await fetchNpgIndex()), cas)
  if (!id) return undefined
  const res = await fetch(`${NPG}/${id}.html`)
  if (!res.ok) throw new Error(`NIOSH page ${id} failed (HTTP ${res.status})`)
  const html = await res.text()
  return {
    page_title: htmlToText(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? ''),
    page_url: `${NPG}/${id}.html`,
    last_reviewed: /cdc:last_reviewed" content="([^"]+)"/.exec(html)?.[1],
    exposure_routes: cardText(html, 'Exposure Routes'),
    symptoms: cardText(html, 'Symptoms'),
    target_organs: cardText(html, 'Target Organs'),
  }
}
