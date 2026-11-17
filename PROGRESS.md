# SafeMix – Progress

Last updated: 2026-11-17

## Done
- **Phase 0 – Setup.** Live at https://shmuelinitzan-cmd.github.io/safemix/
- **Phase 1 – Chemical card.** PubChem search, lab-table card with source badges, NFPA diamond, structure picture, 5 demo cards (acetone density corrected by hand against the CRC Handbook). Pushed and deployed.
- **Phase 1b – Experiment table and export.** Committed locally, **not pushed**.
  - New experiment: pick chemicals, reorder, save (IndexedDB).
  - Landscape PDF in the lab-form column order, with source pages. CSV export of a table.
  - JSON export/import of the whole library, with validation.
  - Intro on the library page ("Demo values verified against the CRC Handbook"), hideable.
  - Tested in the browser on 2026-11-17: all five checks pass.
  - Display fixes (2026-11-17, not committed yet): chemical name never shows "(edited)"; densities in g/cu cm or g/cm³ shown as g/mL (number unchanged); converted values lead, e.g. "180 mmHg at 20 °C (converted from 68 °F)", in the table, CSV, PDF and card.
  - 124 tests, type check, lint and build pass.

- **Pilot on a real experiment (2026-11-17).** Compared SafeMix with Nitzan's hand-filled prep table for Lab 1 (iodoform + alkyl halide tests, 12 chemicals). Physical properties match; gaps were in NFPA and exposure. Fixes:
  - Exposure columns fall back to GHS hazard statements (ECHA, majority of notifiers) when PubChem has no ICSC symptoms. Approved by Nitzan; added to SPEC.
  - Vapour pressure shows the value measured closest to 20 °C (was: always the first listed).
  - Display tidy-up: source notes like "(USCG, 1999)", "- Denser than water", "@", "[mm Hg]" are trimmed in the table and card (full text stays in the details and the PDF sources page). ICSC "kPa at 20 °C: 2 - 2.5" shown as a mmHg range.
  - The lab's five waste categories (from the prep-report header) match the app's five: inorganic, acidic inorganic, basic, organic, halogenated organic.
  - 132 tests, type check, lint and build pass.
- Still missing after the pilot: NFPA for many inorganics (KI, NaOCl, AgNO3, Cu, iodoform, sec/tert-butyl chloride) — no approved source; fill from the supplier SDS. Solutions (NaOCl 5%, AgNO3 2%, HNO3 5%) get pure-compound data.

- **Supplier SDS values and solution cards (2026-11-17, not committed yet).**
  - Edit any value with "From the supplier SDS" ticked: you name the SDS (supplier, product no., revision date) and can add an https link. The value is stored as source "sds", shows a "Supplier SDS" badge, "(SDS)" in the table, and the SDS on the PDF sources page. Without a citation it can't be saved as SDS (it stays "entered by hand").
  - "Make solution card" on a card: e.g. "Nitric Acid, 5% aqueous". Carries only formula, MW (of the solute) and the waste suggestion; pure-compound BP/MP/density/VP/NFPA/exposure are NOT copied. Concentration survives JSON export/import.
  - 140 tests, type check, lint and build pass.

- **GHS instead of NFPA (2026-11-17, not committed yet).** New card field "GHS hazards": the GHS statements at least half of the notifiers reported (ECHA via PubChem), with the strongest signal word among them. When a card has NO NFPA rating, the table, PDF and CSV show one merged GHS cell in place of the four NFPA columns (orange). Never converted to NFPA numbers. Decision: supplier SDS is optional, not required; SafeMix shows what approved sources have and says plainly what is missing. 144 tests pass.

## Next steps (in order) — stopped here on 2026-11-17
1. **Commit and push** the SDS/solution-card work (not pushed yet):
   `cd ~/Desktop/SafeMix && git add -A && git commit -m "Supplier SDS citations on hand-entered values; solution cards" && git push`
   (git identity is now set to Nitzan Shmueli / shmuelinitzan@gmail.com.)
2. *(Optional, not required)* **Fill Lab 1 gaps from supplier SDSs** if a 100% full table is wanted:
   - NFPA missing: KI, NaOCl, AgNO3, Cu, iodoform, 2-chlorobutane, tert-butyl chloride.
   - Exposure missing: KI, 2-chlorobutane, tert-butyl chloride. MP missing: 2-chlorobutane, tert-butyl chloride. VP missing: AgNO3.
   - Solution cards needed: NaOCl 5%, AgNO3 2% in ethanol, HNO3 5%.
   - The "Lab 1 - Iodoform + alkyl halide tests" experiment (12 chemicals) exists only in the Claude app's built-in browser; rebuild it in Nitzan's own browser or via Export all / Import.
3. **Export the Lab 1 PDF and compare** with the hand-filled prep report (dated 5/11/26). Open questions from that comparison, to check against the SDS: Fire 3 for KI and NaOCl in the hand table; tert-butyl chloride VP 17.25 (PubChem 302 mmHg); acetone VP 2.31 (PubChem 180 mmHg at 20 °C); n-butyl chloride Health 0 (PubChem 2); iodoform waste "organic" vs rule "halogenated organic".
4. **Waste:** confirm with the lab where acetic acid and hydrogen peroxide go, and the iodoform case above.
5. **Hydrogen peroxide demo card:** values look like concentrated peroxide; check which concentration the lab uses (probably a solution card).
6. README with screenshots: done 2026-11-17 (images in docs/). Still to add: demo GIF.
7. **Try SafeMix on more experiments** (Nitzan's choice, before any LinkedIn post). LinkedIn post waits until then. Compatibility matrix (Phase 2) on hold ("coming soon" on the button).

## Waiting for Nitzan
1. Commit and push the pilot fixes.
2. Hydrogen peroxide: the demo values (BP 150.2 °C, NFPA 3/3/OX) look like concentrated peroxide. Check against the lab's supplier SDS which concentration the lab uses.
3. Waste: which container acetic acid and hydrogen peroxide go in. Iodoform: the hand table says organic, the rule says halogenated organic; confirm with the lab.

## Next (Nitzan's priority: usable in a real lab)
- Fill Lab 1's gaps from the real supplier SDSs (Nitzan), then export the PDF and compare with the hand-filled prep report.

## Later phase
**Phase 2 – Compatibility matrix** (reactive-group data for the demo chemicals, matrix screen, PDF export). Do not start until Nitzan approves.

## Not built yet
Settings screen (clear local data), NIOSH as fallback source, offline app shell.
