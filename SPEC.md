# SafeMix – Product Spec

Nov 10, 2026 · Nitzan Shmueli · v2 (lab-table card)

## Overview

SafeMix is a web app for lab preparation. You search a chemical by name and get one compact card with exactly the fields of the lab's chemical table (properties, waste container, NFPA rating, exposure hazards), each value cited from an approved source. Next phase: a compatibility matrix that cross-checks the chemicals of an experiment. First target user: an academic chemistry or chemical-engineering teaching lab.

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

PubChem is the live source for every field of the card; NIOSH and CAMEO add detail where PubChem has none.

| Source | Fields it fills | How the app gets it | Phase |
| --- | --- | --- | --- |
| PubChem (NIH) | Name, formula, MW, BP, MP, density, vapour pressure, NFPA rating, exposure symptoms by route (via ICSC/HSDB data inside PubChem) | Live, free REST API (PUG REST / PUG View), lookup by name or CAS | 1 |
| NIOSH Pocket Guide | Exposure symptoms by route (eyes, skin, inhalation, ingestion) where PubChem has none | Static JSON for demo chemicals, prepared from the official pages | 1 |
| CAMEO Chemicals (NOAA) | Reactive groups for the compatibility matrix | Static JSON for demo chemicals | 2 |
| CRC Handbook | Manual cross-check of demo values only | Not ingested, not redistributed | — |

Every stored value keeps its source name, URL and retrieval date. Open question: confirm the terms of use of each source before the public release.

## Features

Four features; the first three make the MVP and need no AI key.

1. **Search a chemical (MVP).** Type a name or CAS number; the app fetches from approved sources and shows one card with only the lab-table fields. Each value has a source badge; missing values show "No data from approved sources". The user can edit a field, and approves the card before saving.
2. **Library and experiment table (MVP).** Saved cards in a searchable list. The user can pick several chemicals into an experiment table that looks like the lab's printed table, one row per chemical.
3. **Export (MVP).** Experiment table as a print-ready PDF (same columns as the lab form, plus a sources page); cards as JSON and CSV; JSON import to move data between computers.
4. **Compatibility matrix (phase 2).** Cross-check the chemicals of an experiment table: a grid of Compatible / Caution / Incompatible, with the reason and source for each cell, exportable as PDF.

Later, optional: reading a supplier SDS PDF with AI, under the grounded-AI rules.

## Chemical card data model

A card holds exactly the columns of the lab's chemical table, nothing more, and every field carries its provenance.

| Group | Field | Unit | Source |
| --- | --- | --- | --- |
| Identity | Chemical name (English) | — | PubChem |
| Identity | Chemical formula | — | PubChem |
| Identity | Molecular weight (MW) | g/mol | PubChem |
| Properties | Boiling point (BP) | °C | PubChem |
| Properties | Melting point (MP) | °C | PubChem |
| Properties | Density | g/mL | PubChem |
| Properties | Vapour pressure | mmHg | PubChem |
| Disposal | Waste container: inorganic / acidic inorganic / basic / organic / halogenated organic | — | Rule-based suggestion from the formula and source data, confirmed by the user |
| NFPA 704 (0–4) | Fire, Health, Reactivity, Special hazards | 0–4 / symbol | PubChem |
| Exposure hazards | Eyes, Skin, Inhalation, Ingestion | text | PubChem (ICSC), NIOSH |

Units: the original source value is stored as given. If it is in another unit (e.g. °F), the card also shows a converted value labelled "converted". Values that apply only to one concentration keep a `condition` note (e.g. ">60% solution").

Waste container rule: the app suggests a category by a fixed, documented rule (halogen in an organic formula → halogenated organic, etc.). The card marks it "Rule-based, confirm with lab instructions" until the user approves it. The five category names must match the lab's own list.

Each field is stored as:

```json
{
  "value": "56.05",
  "unit": "°C",
  "condition": null,
  "source": "pubchem",
  "source_url": "https://pubchem.ncbi.nlm.nih.gov/compound/180",
  "retrieved_at": "2026-11-10",
  "origin": "source | user | rule",
  "status": "pending | approved"
}
```

## Screens

Same look as the live Phase 0 site; the card replaces the 16-section editor.

1. **Home / Library.** Search bar, list of saved chemicals (name, formula, NFPA diamond), buttons: Import, Export all, New experiment, Compatibility check.
2. **Chemical card.** One screen with the lab-table fields in four blocks: Identity and properties, Waste container, NFPA diamond (drawn in its 4 colours), Exposure hazards by route. Each value has a source badge and an Edit option; one Approve and save button for the card.
3. **Experiment table.** Rows of chosen chemicals in the same column layout as the lab's printed form. Export PDF.
4. **Compatibility check (phase 2).** The chemicals of an experiment table as a colour-coded matrix; click a cell for the reason and source.
5. **Settings.** Clear local data, about and disclaimer.

A persistent banner on every card: "Draft for educational use. Verify against the supplier SDS before use."

## Tech stack and hosting

A browser-only app with no server, hosted free on GitHub Pages.

| Area | Choice | Why |
| --- | --- | --- |
| Framework | Vite + React + TypeScript | Common, recruiter-recognisable, easy for Claude Code |
| Styling | Tailwind CSS | Fast, consistent UI |
| Storage | IndexedDB in the browser (via Dexie) | Cards persist on this computer; no login, no server |
| Data transfer | JSON export / import | Moves the library between computers |
| PDF export | jsPDF or the browser's print-to-PDF | Print-ready experiment table and matrix |
| PDF reading (optional later) | pdf.js, in the browser | Uploaded files never leave the user's computer except to the AI call |
| AI (optional later) | Pluggable provider module; user pastes own API key in Settings | The public site never holds your key; demo works without a key |
| Tests | Vitest | Data mapping, waste rule, grounding verifier |
| Hosting | GitHub Pages | Same setup as the workout app |

**Demo mode.** The app ships with 5 pre-built cards: acetone, ethanol, glacial acetic acid, sodium hydroxide, hydrogen peroxide. A recruiter can explore everything without any key.

To check in phase 1: that PubChem's API can be called directly from the browser (CORS). If not, fall back to pre-fetched JSON for the demo chemicals.

## Build phases for Claude Code

Build in this order, one phase per Claude Code session, and finish each with a working, deployed version. Save this spec in the repo as `SPEC.md` and the grounded-AI rules in `CLAUDE.md`, so every session follows them.

1. **Phase 0 – Setup.** Done and live at shmuelinitzan-cmd.github.io/safemix.
2. **Phase 1 – Chemical card.** Lab-table data model, PubChem search by name/CAS, the card screen with source badges and NFPA diamond, waste-container rule, IndexedDB storage, 5 demo chemicals (acetone, ethanol, glacial acetic acid, sodium hydroxide, hydrogen peroxide) reviewed by Nitzan before saving.
3. **Phase 1b – Experiment table and export.** Pick chemicals into a table, PDF export in the lab form layout, JSON/CSV export and import.
4. **Phase 2 – Compatibility matrix.** Reactive-group data for the demo chemicals, matrix screen, PDF export.
5. **Phase 3 – Polish.** README with screenshots and a demo GIF, accessibility check, LinkedIn post.
6. **Optional later – AI.** Reading a supplier SDS PDF under the grounded-AI rules.

Nitzan's own check after each phase: verify demo values by hand against the CRC Handbook and the supplier SDS.

## Scope, disclaimer and CV framing

**Out of scope for now:** full 16-section SDS cards, user accounts, a shared server database, mixtures with many ingredients, Hebrew interface, regulatory sign-off.

**Disclaimer (in app and README):** SafeMix produces draft safety cards for education and lab organisation. It is not a legally valid SDS and does not replace the supplier's sheet or the lab safety officer.

**CV line (draft):** Built SafeMix, a browser-based lab-preparation tool that turns a chemical name into a cited safety card (properties, NFPA 704, exposure hazards, waste category) from PubChem and NIOSH, and cross-checks an experiment's chemicals in a compatibility matrix. Every value is source-cited; nothing is AI-generated. React, TypeScript, AI-assisted development (Claude Code). Live demo + GitHub.

**LinkedIn post angle:** what mixing spray chemicals in Australia taught you about reading SDS, and why the AI in your tool is not allowed to guess.
