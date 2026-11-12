# SafeMix – Progress

Last updated: 2026-11-12

## Done
- **Phase 0 – Setup.** Live at https://shmuelinitzan-cmd.github.io/safemix/
- **Phase 1 – Chemical card.** PubChem search, lab-table card with source badges, NFPA diamond, structure picture, 5 demo cards (acetone density corrected by hand against the CRC Handbook). Pushed and deployed.
- **Phase 1b – Experiment table and export.** Committed locally, **not pushed**.
  - New experiment: pick chemicals, reorder, save (IndexedDB).
  - Landscape PDF in the lab-form column order, with source pages. CSV export of a table.
  - JSON export/import of the whole library, with validation.
  - Intro on the library page ("Demo values verified against the CRC Handbook"), hideable.
  - 122 tests, type check, lint and build pass.

## Waiting for Nitzan
1. Test Phase 1b locally: `cd ~/Desktop/SafeMix`, `npm run dev`, open the printed address (usually http://localhost:5173). Try New experiment, Save, Export PDF/CSV, Export all, Import, Hide intro.
2. Then tell Claude to push (repo: `shmuelinitzan-cmd/safemix`).
3. Lab waste categories: the exact names of the five categories, and which one acetic acid and hydrogen peroxide go in. Until then all waste containers stay pending (marked †).

## Next phase
**Phase 2 – Compatibility matrix** (reactive-group data for the demo chemicals, matrix screen, PDF export). Do not start until Nitzan approves.

## Not built yet
Settings screen (clear local data), NIOSH as fallback source, offline app shell.
