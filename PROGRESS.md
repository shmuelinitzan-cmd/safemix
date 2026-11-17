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

## Waiting for Nitzan
1. Commit the display fixes and push Phase 1b (repo: `shmuelinitzan-cmd/safemix`).
2. Hydrogen peroxide: the demo values (BP 150.2 °C, NFPA 3/3/OX) look like concentrated peroxide. Check against the lab's supplier SDS which concentration the lab uses.
3. Lab waste categories: the exact names of the five categories, and which one acetic acid and hydrogen peroxide go in. Until then all waste containers stay pending (marked †).

## Next phase
**Phase 2 – Compatibility matrix** (reactive-group data for the demo chemicals, matrix screen, PDF export). Do not start until Nitzan approves.

## Not built yet
Settings screen (clear local data), NIOSH as fallback source, offline app shell.
