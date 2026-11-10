# SafeMix – Product Spec

Nov 10, 2026 · Nitzan Shmueli

## Overview

SafeMix is a web app that turns chemical Safety Data Sheets (SDS) into structured, verified records, lets users fill new SDS cards from a guided form, and exports them. First target user: an academic chemistry or chemical-engineering teaching lab.

**Problem.** Labs handle dozens of chemicals. Their SDS files are long, inconsistent PDFs from different suppliers, so answering "what PPE, what if it spills, can I store these together" is slow.

**Portfolio goal.** A live demo plus a public GitHub repo that shows chemical-safety knowledge, data handling and responsible AI use, for a student position in chemical, energy or environmental industry.

**Interface language:** English.

## Core principle: grounded AI only

The AI never creates safety data. It only reorganizes, quotes and explains data that the app itself retrieved from approved sources or from a PDF the user uploaded. This is a hard requirement, enforced in code, not only in the prompt.

1. **No web access for the AI.** The AI model has no browsing or search tool. The app's own code fetches data from the approved APIs; the AI receives only that data.
2. **Context-only answers.** Every AI call receives a `context` object (retrieved records + uploaded PDF text). The system prompt forbids using any value not present in it.
3. **Every value cites its source.** The AI must return JSON where each field holds `value`, `source_id` and a short `quote` from the context.
4. **Code-level verification.** After each AI response, the app checks that every `quote` appears in the context and every number matches. Anything that fails is discarded and flagged, never shown as fact.
5. **Missing means missing.** If a field is not in the context, it stays empty with the label "No data from approved sources". The AI may not fill gaps from general knowledge.
6. **Wording vs. data.** The AI may suggest plain-English wording for text sections (e.g. handling advice), but only by rephrasing quoted source text. These suggestions are marked "AI-drafted, needs review".
7. **Human approval.** No field enters a saved card until the user accepts it.

## Approved data sources

PubChem is the primary live source; everything else is bundled as static, source-labelled data for the demo chemicals.

| Source | What it provides | How the app gets it | Phase |
| --- | --- | --- | --- |
| PubChem (NIH) | Identity, CAS, GHS classification, H/P statements, pictograms, physical properties, toxicity | Live, free REST API (PUG REST / PUG View), lookup by name or CAS | 1 |
| NIOSH Pocket Guide | Exposure limits, PPE, first aid, incompatibilities | Static JSON for demo chemicals, prepared by hand from the official pages | 1 |
| CAMEO Chemicals (NOAA) | Reactive groups for the compatibility matrix | Static JSON for demo chemicals | 2 |
| Uploaded SDS PDF | Supplier data for one product | User upload, text extracted in the browser | 3 |
| CRC Handbook | Manual cross-check of demo values only | Not ingested, not redistributed | — |

Every stored value keeps its source name, URL and retrieval date. Open question: confirm the terms of use of each source before the public release.

## Features

Five features; the first three make the MVP and work with no AI key.

1. **Fill an SDS from the interface (MVP).** Guided 16-section form. User types a chemical name or CAS number; the app pre-fills fields from approved sources, each with a source badge. User edits, completes and approves each section.
2. **Chemical library (MVP).** List of saved cards with search, filter by hazard class, and a summary view: pictograms, signal word, PPE, first aid.
3. **Export (MVP).** One card as a print-ready PDF (16 sections + sources page); one card or the whole library as JSON; the library as CSV; import from JSON to move data between computers.
4. **Compatibility matrix (phase 2).** Select 2–10 chemicals; get a grid of Compatible / Caution / Incompatible with the reason and source for each cell. Exportable as a PDF to post in the storeroom.
5. **Read an uploaded SDS PDF (phase 3, needs AI key).** The AI maps the PDF text into the 16 sections under the grounded-AI rules, then the user reviews it in the same form as feature 1.

## SDS data model

A card follows the 16 GHS sections, and every field carries its provenance.

| # | Section | Main pre-fill source |
| --- | --- | --- |
| 1 | Identification | PubChem |
| 2 | Hazard identification (GHS class, pictograms, signal word, H/P statements) | PubChem |
| 3 | Composition / ingredients | PubChem |
| 4 | First-aid measures | NIOSH |
| 5 | Fire-fighting measures | User / uploaded SDS |
| 6 | Accidental release measures | User / uploaded SDS |
| 7 | Handling and storage | User / uploaded SDS |
| 8 | Exposure controls / PPE | NIOSH |
| 9 | Physical and chemical properties | PubChem |
| 10 | Stability and reactivity | NIOSH, CAMEO |
| 11 | Toxicological information | PubChem |
| 12 | Ecological information | User / uploaded SDS |
| 13 | Disposal considerations | User / uploaded SDS |
| 14 | Transport information | User / uploaded SDS |
| 15 | Regulatory information | User / uploaded SDS |
| 16 | Other information (revision date, author) | App |

Each field is stored as:

```json
{
  "value": "56.05",
  "unit": "°C",
  "source": "pubchem",
  "source_url": "https://pubchem.ncbi.nlm.nih.gov/compound/180",
  "retrieved_at": "2026-11-10",
  "origin": "source | user | ai_draft",
  "status": "pending | approved"
}
```

## Screens

Five screens, with a clean lab-safety look and GHS pictograms as the main visual language.

1. **Home / Library.** Search bar, card grid (name, CAS, pictograms, signal word), buttons: New card, Import, Export all, Compatibility check.
2. **Card editor.** Left: list of the 16 sections with a status dot (empty / pre-filled / approved). Right: the section form. Each field shows a source badge (PubChem, NIOSH, User, AI draft) and an Approve button.
3. **Card view.** Read-only, print-friendly layout of the full SDS, plus a Sources page listing every URL and retrieval date. Export PDF / JSON.
4. **Compatibility check (phase 2).** Pick chemicals from the library, see the colour-coded matrix, click a cell for the reason and source.
5. **Settings.** Paste own AI API key (stored only in this browser), clear local data, about and disclaimer.

A persistent banner on every card: "Draft for educational use. Verify against the supplier SDS before use."

## Tech stack and hosting

A browser-only app with no server, hosted free on GitHub Pages.

| Area | Choice | Why |
| --- | --- | --- |
| Framework | Vite + React + TypeScript | Common, recruiter-recognisable, easy for Claude Code |
| Styling | Tailwind CSS | Fast, consistent UI |
| Storage | IndexedDB in the browser (via Dexie) | Cards persist on this computer; no login, no server |
| Data transfer | JSON export / import | Moves the library between computers |
| PDF export | jsPDF or the browser's print-to-PDF | Print-ready SDS and matrix |
| PDF reading (phase 3) | pdf.js, in the browser | Uploaded files never leave the user's computer except to the AI call |
| AI (phase 3) | Pluggable provider module; user pastes own API key in Settings | The public site never holds your key; demo works without a key |
| Tests | Vitest | Required for the grounding verifier |
| Hosting | GitHub Pages | Same setup as the workout app |

**Demo mode.** The app ships with 5 pre-built cards: acetone, ethanol, hydrochloric acid, sodium hydroxide, hydrogen peroxide. A recruiter can explore everything without any key.

To check in phase 1: that PubChem's API can be called directly from the browser (CORS). If not, fall back to pre-fetched JSON for the demo chemicals.

## Build phases for Claude Code

Build in this order, one phase per Claude Code session, and finish each with a working, deployed version. Save this spec in the repo as `SPEC.md` and the grounded-AI rules in `CLAUDE.md`, so every session follows them.

1. **Phase 0 – Setup.** Repo, Vite + React + TS, Tailwind, GitHub Pages deploy, empty library screen.
2. **Phase 1 – Cards without AI.** Data model, 16-section editor, IndexedDB storage, PubChem lookup by name/CAS with source badges, the 5 demo cards.
3. **Phase 1b – Export.** PDF, JSON, CSV export and JSON import.
4. **Phase 2 – Compatibility matrix.** Reactive-group data for demo chemicals, matrix screen, PDF export.
5. **Phase 3 – AI layer.** Settings with own API key, PDF upload and text extraction, AI mapping into sections, the grounding verifier with tests, review flow.
6. **Phase 4 – Polish.** README with screenshots and a short demo GIF, accessibility check, LinkedIn post.

Nitzan's own check after each phase: verify demo values by hand against the CRC Handbook and the supplier SDS.

## Scope, disclaimer and CV framing

**Out of scope for now:** user accounts, a shared server database, mixtures with many ingredients, Hebrew interface, regulatory sign-off.

**Disclaimer (in app and README):** SafeMix produces draft SDS cards for education and lab organisation. It is not a legally valid SDS and does not replace the supplier's sheet or the lab safety officer.

**CV line (draft):** Built SafeMix, a browser-based chemical safety assistant that structures SDS data into the 16 GHS sections from PubChem and NIOSH, with a grounded-AI layer that cites a source for every value and rejects unsupported output. React, TypeScript, AI-assisted development (Claude Code). Live demo + GitHub.

**LinkedIn post angle:** what mixing spray chemicals in Australia taught you about reading SDS, and why the AI in your tool is not allowed to guess.
