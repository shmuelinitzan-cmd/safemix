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

## Waiting for Nitzan
1. Commit and push the pilot fixes.
2. Hydrogen peroxide: the demo values (BP 150.2 °C, NFPA 3/3/OX) look like concentrated peroxide. Check against the lab's supplier SDS which concentration the lab uses.
3. Waste: which container acetic acid and hydrogen peroxide go in. Iodoform: the hand table says organic, the rule says halogenated organic; confirm with the lab.

## Next (Nitzan's priority: usable in a real lab)
- Solution cards with a concentration, and hand-entered values cited to the supplier SDS (supplier + revision date).

## Later phase
**Phase 2 – Compatibility matrix** (reactive-group data for the demo chemicals, matrix screen, PDF export). Do not start until Nitzan approves.

## Not built yet
Settings screen (clear local data), NIOSH as fallback source, offline app shell.
