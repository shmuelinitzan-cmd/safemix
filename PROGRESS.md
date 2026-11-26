# SafeMix – Progress

Last updated: 2026-11-26

**Current phase:** piloting SafeMix on real lab experiments.

**Git:** everything up to commit `10b538b` (2026-11-17) is pushed to `shmuelinitzan-cmd/safemix`. The 2026-11-26 changes below are committed locally, **not pushed**, so the live site doesn't have them yet.

## Done
- **Phase 0 – Setup.** Live at https://shmuelinitzan-cmd.github.io/safemix/
- **Phase 1 – Chemical card.** PubChem search, lab-table card with source badges, NFPA diamond, structure picture, 5 demo cards (acetone density corrected by hand against the CRC Handbook; no other CRC check is documented). Pushed and deployed.
- **Phase 1b – Experiment table and export.** Pushed.
  - New experiment: pick chemicals, reorder, save (IndexedDB).
  - Landscape PDF in the lab-form column order, with source pages. CSV export of a table.
  - JSON export/import of the whole library, with validation.
  - Intro on the library page, hideable (CRC sentence narrowed on 2026-11-26).
  - Tested in the browser on 2026-11-17: all five checks pass.
  - Display fixes (2026-11-17): chemical name never shows "(edited)"; densities in g/cu cm or g/cm³ shown as g/mL (number unchanged); converted values lead, e.g. "180 mmHg at 20 °C (converted from 68 °F)", in the table, CSV, PDF and card.
  - 124 tests, type check, lint and build pass.

- **Pilot on a real experiment (2026-11-17).** Compared SafeMix with Nitzan's hand-filled prep table for Lab 1 (iodoform + alkyl halide tests, 12 chemicals). Physical properties match; gaps were in NFPA and exposure. Fixes:
  - Exposure columns fall back to GHS hazard statements (ECHA, majority of notifiers) when PubChem has no ICSC symptoms. Approved by Nitzan; added to SPEC.
  - Vapour pressure shows the value measured closest to 20 °C (was: always the first listed).
  - Display tidy-up: source notes like "(USCG, 1999)", "- Denser than water", "@", "[mm Hg]" are trimmed in the table and card (full text stays in the details and the PDF sources page). ICSC "kPa at 20 °C: 2 - 2.5" shown as a mmHg range.
  - The lab's five waste categories (from the prep-report header) match the app's five: inorganic, acidic inorganic, basic, organic, halogenated organic.
  - 132 tests, type check, lint and build pass.
- Still missing after the pilot: NFPA for many inorganics (KI, NaOCl, AgNO3, Cu, iodoform, sec/tert-butyl chloride) — no approved source; fill from the supplier SDS. Solutions (NaOCl 5%, AgNO3 2%, HNO3 5%) get pure-compound data.

- **Supplier SDS values and solution cards (2026-11-17, pushed).**
  - Edit any value with "From the supplier SDS" ticked: you name the SDS (supplier, product no., revision date) and can add an https link. The value is stored as source "sds", shows a "Supplier SDS" badge, "(SDS)" in the table, and the SDS on the PDF sources page. Without a citation it can't be saved as SDS (it stays "entered by hand").
  - "Make solution card" on a card: e.g. "Nitric Acid, 5% aqueous". Carries only formula, MW (of the solute) and the waste suggestion; pure-compound BP/MP/density/VP/NFPA/exposure are NOT copied. Concentration survives JSON export/import.
  - 140 tests, type check, lint and build pass.

- **GHS instead of NFPA (2026-11-17, pushed).** New card field "GHS hazards": the GHS statements at least half of the notifiers reported (ECHA via PubChem), with the strongest signal word among them. When a card has NO NFPA rating, the table, PDF and CSV show one merged GHS cell in place of the four NFPA columns (orange). Never converted to NFPA numbers. Decision: supplier SDS is optional, not required; SafeMix shows what approved sources have and says plainly what is missing. 144 tests pass.
- README with screenshots (2026-11-17, pushed; images in docs/).

- **Honesty fixes (2026-11-26, committed, not pushed).**
  - Intro now mentions only the documented CRC correction (acetone density). Which other demo values were checked against CRC can't be confirmed.
  - Hydrogen peroxide demo card marked "Concentration not verified" (card, library, experiment table, PDF, CSV; kept in JSON export/import). Browsers that already have the card get the mark on next load.
  - GHS notes: only ECHA entries mention notifiers; otherwise the note names the real source. Keeping statements with no percentage is intended. Cards already saved keep their old note.
  - NIOSH is not planned for now: removed from SPEC and the draft CV line. The reader (`src/lib/niosh.ts`, used only by `scripts/review-pubchem.ts`) is still in the code.
  - Values typed in by hand without a named SDS (including names and a hand-picked waste container) show "Not verified" on the card, experiment table, PDF and CSV; the NFPA diamond stars them. Approval doesn't remove it. Named-SDS values keep "(SDS)". The documented acetone density correction shows "CRC Handbook 107th ed." as its source. Logic in `src/lib/provenance.ts`.
  - README: the three hand-filled-table "inconsistencies" are marked "Not verified". CV line replaced in SPEC.
  - 160 tests, type check, lint and build pass.
- **Fixes from the browser check (2026-11-26, committed, not pushed).**
  - Earlier values read "Previous value: …" (card and PDF); before, a rule-based waste suggestion was labelled "PubChem had".
  - PDF: NFPA columns mark unverified values with "*", explained below the table; the introduction allows for "Not verified" values.
  - Library: all diamonds take the same width, so names line up.
  - 163 tests, type check, lint and build pass.
  - Checked in headless Chrome with an empty profile: the labels, the four fixes, a live PubChem search (iodoform: GHS shown where there is no NFPA rating) and a 390 px phone screen (see Known issues). Not checked in a browser: live non-ECHA GHS note, library export / import, solution cards, a physical phone.

## Next steps (pilot phase)
1. **Ask Nitzan before pushing** the 2026-11-26 commits. Retake the README screenshots (`docs/library.jpg` predates the peroxide mark; check the others).
2. **Try SafeMix on more real experiments** (Nitzan's choice of experiments, before any LinkedIn post; the post waits until then).
3. **Export the Lab 1 PDF and compare** with the hand-filled prep report (dated 5/11/26). The "Lab 1 - Iodoform + alkyl halide tests" experiment (12 chemicals) was, as of 2026-11-17, only in the Claude app's built-in browser; rebuild it in Nitzan's own browser or use Export all / Import.
4. *(Optional)* **Fill Lab 1 gaps from supplier SDSs:**
   - NFPA missing: KI, NaOCl, AgNO3, Cu, iodoform, 2-chlorobutane, tert-butyl chloride.
   - Exposure missing: KI, 2-chlorobutane, tert-butyl chloride. MP missing: 2-chlorobutane, tert-butyl chloride. VP missing: AgNO3.
   - Solution cards needed: NaOCl 5%, AgNO3 2% in ethanol, HNO3 5%. A solution looked up as the pure compound gets pure-compound data.
5. README: add a demo GIF.

## Not verified
- **Hydrogen peroxide concentration:** the demo values (BP 150.2 °C, NFPA 3/3/OX) look like concentrated peroxide. Which concentration they belong to, and which the lab uses, is not verified.
- **CRC check of demo values:** only the acetone density correction is documented.
- **Lab 1 comparison with the hand-filled table**, to check against the SDS: Fire 3 for KI and NaOCl; tert-butyl chloride VP 17.25 (PubChem 302 mmHg); acetone VP 2.31 (PubChem 180 mmHg at 20 °C); n-butyl chloride Health 0 (PubChem 2); iodoform waste "organic" vs rule "halogenated organic".

## Known issues
- **Peroxide mark is tied to the stored card ID** (left as is for now, Nitzan's decision 2026-11-26). It's added to the demo card, or any stored card with ID `cas-7722-84-1`. If that card is deleted and hydrogen peroxide is looked up again, the new card has no "Concentration not verified" mark. Replacing it from an older backup removes the mark until the app reloads.
- Cards saved before 2026-11-26 keep their old GHS note.
- The CSV, the on-screen experiment table and the library list don't name the source of PubChem values; the card and the PDF sources pages do.
- **Phone screens:** opening "Source details" on a card makes the page wider than the screen (390 px screen, 514 px page) and cuts off the citation and link (`Details` in `src/components/FieldRow.tsx`).
- Phone screens, minor: the search boxes' placeholder text is cut off; the experiment table scrolls sideways inside its box, and the chemical name scrolls out of view.

## Waiting for Nitzan
1. Waste: which container acetic acid and hydrogen peroxide go in. Iodoform: the hand table says organic, the rule says halogenated organic; confirm with the lab.
2. Hydrogen peroxide: when possible, check the concentration on the lab's supplier SDS.

## Later phase
**Phase 2 – Compatibility matrix**, on hold ("coming soon" on the button) (reactive-group data for the demo chemicals, matrix screen, PDF export). Do not start until Nitzan approves.

## Not built yet
Settings screen (clear local data), offline app shell. NIOSH is not planned for now.
