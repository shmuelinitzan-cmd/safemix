# SafeMix – Progress

Last updated: 2026-11-26

**Current phase:** piloting SafeMix on real lab experiments.

**Git:** the 2026-11-26 changes below are pushed to `shmuelinitzan-cmd/safemix` (Nitzan approved the push). A push to `main` deploys the live site through GitHub Actions.

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

- **Honesty fixes (2026-11-26, pushed).**
  - Intro now mentions only the documented CRC correction (acetone density). Which other demo values were checked against CRC can't be confirmed.
  - Hydrogen peroxide demo card marked "Concentration not verified" (card, library, experiment table, PDF, CSV; kept in JSON export/import). Browsers that already have the card get the mark on next load.
  - GHS notes: only ECHA entries mention notifiers; otherwise the note names the real source. Keeping statements with no percentage is intended. Cards already saved keep their old note.
  - NIOSH is not planned for now: removed from SPEC and the draft CV line. The reader (`src/lib/niosh.ts`, used only by `scripts/review-pubchem.ts`) is still in the code.
  - Values typed in by hand without a named SDS (including names and a hand-picked waste container) show "Not verified" on the card, experiment table, PDF and CSV; the NFPA diamond stars them. Approval doesn't remove it. Named-SDS values keep "(SDS)". The documented acetone density correction shows "CRC Handbook 107th ed." as its source. Logic in `src/lib/provenance.ts`.
  - README: the three hand-filled-table "inconsistencies" are marked "Not verified". CV line replaced in SPEC.
  - 160 tests, type check, lint and build pass.
- **Fixes from the browser check (2026-11-26, pushed).**
  - Earlier values read "Previous value: …" (card and PDF); before, a rule-based waste suggestion was labelled "PubChem had".
  - PDF: NFPA columns mark unverified values with "*", explained below the table; the introduction allows for "Not verified" values.
  - Library: all diamonds take the same width, so names line up.
  - 163 tests, type check, lint and build pass.
  - Checked in headless Chrome with an empty profile: the labels, the four fixes, a live PubChem search (iodoform: GHS shown where there is no NFPA rating) and a 390 px phone screen (see Known issues). Not checked in a browser: live non-ECHA GHS note, library export / import, solution cards, a physical phone.
- **Phone fixes (2026-11-26, pushed).**
  - "Source details" wraps long citations and links.
  - The experiment table keeps the chemical name column pinned while scrolling sideways. The table now uses separate borders (collapsed borders let scrolled text show beside the pinned cell).
  - 163 tests, type check, lint and build pass. Checked in headless Chrome: at 390 and 320 px, no text in the opened "Source details" is cut off on six cards, and the name column stays visible across the table scroll; desktop looks right. Not checked on a physical phone or in Safari.
- **README screenshots retaken (2026-11-26).** Same file names and pixel sizes, from a new Chrome profile. Library, card and PDF images use only the five demo cards; the table image adds iodoform (live PubChem lookup) so a GHS row shows. Its waste suggestion was kept unconfirmed (†) in that test profile. For the table image only, the page width limit was lifted to keep the old framing.

- **Test plan, stage 1 (2026-11-27, local branch `tests`, not pushed).**
  - New tests for unit conversions (`src/lib/units.test.ts`) and retrieval with a fake network (`src/lib/fetch.test.ts`). App code unchanged.
  - 295 tests: 288 pass, 7 are "expected fail" (known bugs, `it.fails`, not fixed; waiting for Nitzan's decision). Tests also pass with the network blocked; lint and build (with type check) pass.
  - Bugs: (1) and (2) a range repeating °F ("to" or dash) is half-converted; (3) the same for a kPa range in vapour pressure; (4) vapour pressure ignores temperatures in K when picking the value nearest 20 °C; (5) density: a °F measuring temperature without "at" is not converted; (6) an empty PubChem record is accepted; (7) any HTTP error reads "could not find" (GitHub issue #3). All use made-up inputs; whether real PubChem text triggers 1–6 is not verified.
  - **Fixes (2026-11-27, approved by Nitzan, not pushed):** bugs 1–3 (a temperature or pressure range that can't be converted as a whole is left as the source wrote it, including its measuring temperature; the same for a measuring-temperature range with a °F end, in vapour pressure and density) and bug 6 (an empty or incomplete record is an error, so no card). Ranges are recognised when joined by a dash or "to". Display of the demo cards is unchanged.
  - Now 323 tests: 320 pass, 3 expected fail (bugs 4, 5, 7). Lint and build pass. The counts and bug list above describe the state before the fixes.
  - Open GitHub issues: #3 (503 message), #4 (kelvin), #5 (°F without "at"), #6 (decide: several CIDs, no timeout).
- **Test plan, stage 2 (2026-11-27, local branch `tests`, not pushed).**
  - New tests for molecular weight and formula parsing (`src/lib/mw.test.ts`) and PubChem record parsing (`src/lib/pubchem.test.ts`), with fake records. App code unchanged.
  - 429 tests: 418 pass, 11 expected fail (3 from stage 1, 8 new). Pass with the network blocked; lint and build pass.
  - New bugs, not fixed (waiting for Nitzan): (8) a value made only of spaces is accepted for MW, exposure symptoms (which also blocks the GHS fallback) and CAS; (9) NFPA "1.5" or "1-2" is read as 1; (10) the table, CSV and PDF cells drop the MW unit; (11) formula parsing ignores group and hydrate multipliers. Whether real PubChem data triggers 8–11 is not verified.
  - Current behaviour, pinned by a test: a combined GHS code ("H302+H332") or a "<" share is dropped without a notice. Whether PubChem uses these forms there is not verified.
  - **Fixes (2026-11-27, approved by Nitzan, not pushed):** bug 8 (blank text counts as missing, so the GHS fallback still works); bug 9 (an NFPA rating must be one whole number 0–4, alone or followed by " - explanation"; anything else is shown as written and "Not verified", `?*` in the diamond if too long); GHS lines (combined codes like "H302+H332" are read; a line that can't be read is shown as written in the GHS summary and in the route of each code it mentions; a line without a code is in the summary only). Statements under 50% are still left out, as SPEC says.
  - Now 457 tests: 451 pass, 6 expected fail (bugs 4, 5, 7, 10, 11).
  - Open GitHub issues: #3–#6, plus #7 (MW unit not shown in the table) and #8 (formula groups and hydrates).
- **Test plan, stage 3 (2026-11-27, local branch `tests`, not pushed).**
  - Real PubChem records for the 5 demo chemicals and iodoform in `src/lib/__fixtures__/`, trimmed to the sections the parser reads (whole sections removed, no remaining text changed; about 1.6 MB, was 10.8 MB). Each has a `.source.txt` (CID, URL, retrieval date, checksums of the original and trimmed file). `src/lib/fixtures.test.ts` checks the trimmed checksum, that every PubChem value is in the record, and the recorded parser output. The full originals are not in the pushed history.
  - `npm run test:live` (opt-in, not in `npm test` or the deploy): 24 checks, all passed on 2026-11-27.
  - 498 tests: 492 pass, 6 expected fail (bugs 4, 5, 7, 10, 11). Pass with the network blocked; lint and build pass.
  - On these 6 records: the old (`main`) and fixed parsers give the same card values; no text found that triggers bugs 4, 5, 10 or 11; no combined GHS lines or NFPA ranges. This covers these records only.
  - Also: when an NFPA rating can't be read, the table, PDF and CSV show the NFPA text and the GHS cell together (SPEC updated). PDF page breaks checked with fake data; the on-screen layout was checked by tests only, not in a browser.
  - `deploy.yml` runs lint and tests before the build. This closes the testing task: anything new becomes a GitHub issue.
- **PR checks and rules (2026-11-27, branch `tests`, PR #10).** CLAUDE.md has a "Definition of done". `.github/workflows/pr.yml` runs lint and tests on every Pull Request, without deploying (issue #9). PR #10 was merged and deployed on 2026-11-27.
- **Lab 3+4 check and fix (2026-11-27).** 15 chemicals looked up in the app on `tests` and on `main`; all found, and every value labelled PubChem was in the record the app received. The one difference from `main` was sodium bicarbonate, whose "Not Classified" text showed as a hazard statement. Fixed: it reads "Not classified (no GHS hazard)" with its source. Open findings: GitHub issues for the 4-aminophenol density, the carbonate waste suggestion, the single GHS entry, the sodium bicarbonate melting point, and the Node 20 actions warning. The remaining finding (GHS summary left out of the table when a card has NFPA ratings) is fixed below.
- **GHS in the printed table (2026-11-27, branch `ghs-in-table`, separate PR, not merged). Closes this project phase once merged.**
  - Every card with a GHS summary now shows it in the experiment table, CSV and PDF main table; with NFPA data, on a second line under the ratings (e.g. H351 on dichloromethane, H341 on 4-aminophenol). SPEC and README text updated.
  - Checked with the 15 lab records saved on 2026-11-27: 28 card codes all in the PDF table pages, none missing from the CSV; screen checked in headless Chrome (desktop and 390 px).
  - Limit: only the summary stored on the card can be printed. The 5 demo cards store none, so their rows are unchanged; the same goes for any saved card without one. Hazards in other GHS entries of a record are still not shown (issue #13).
  - README screenshots show the earlier layout (not retaken).

## Next steps (pilot phase)
1. **Try SafeMix on more real experiments** (Nitzan's choice of experiments, before any LinkedIn post; the post waits until then).
2. **Export the Lab 1 PDF and compare** with the hand-filled prep report (dated 5/11/26). The "Lab 1 - Iodoform + alkyl halide tests" experiment (12 chemicals) was, as of 2026-11-17, only in the Claude app's built-in browser; rebuild it in Nitzan's own browser or use Export all / Import.
3. *(Optional)* **Fill Lab 1 gaps from supplier SDSs:**
   - NFPA missing: KI, NaOCl, AgNO3, Cu, iodoform, 2-chlorobutane, tert-butyl chloride.
   - Exposure missing: KI, 2-chlorobutane, tert-butyl chloride. MP missing: 2-chlorobutane, tert-butyl chloride. VP missing: AgNO3.
   - Solution cards needed: NaOCl 5%, AgNO3 2% in ethanol, HNO3 5%. A solution looked up as the pure compound gets pure-compound data.
4. README: add a demo GIF.

## Not verified
- **Hydrogen peroxide concentration:** the demo values (BP 150.2 °C, NFPA 3/3/OX) look like concentrated peroxide. Which concentration they belong to, and which the lab uses, is not verified.
- **CRC check of demo values:** only the acetone density correction is documented.
- **Lab 1 comparison with the hand-filled table**, to check against the SDS: Fire 3 for KI and NaOCl; tert-butyl chloride VP 17.25 (PubChem 302 mmHg); acetone VP 2.31 (PubChem 180 mmHg at 20 °C); n-butyl chloride Health 0 (PubChem 2); iodoform waste "organic" vs rule "halogenated organic".

## Known issues
- **Peroxide mark is tied to the stored card ID** (left as is for now, Nitzan's decision 2026-11-26). It's added to the demo card, or any stored card with ID `cas-7722-84-1`. If that card is deleted and hydrogen peroxide is looked up again, the new card has no "Concentration not verified" mark. Replacing it from an older backup removes the mark until the app reloads.
- Cards saved before 2026-11-26 keep their old GHS note.
- The CSV, the on-screen experiment table and the library list don't name the source of PubChem values; the card and the PDF sources pages do.
- Very narrow phones (320 px): on some cards with a structure picture (ethanol, acetic acid), the picture makes the page 16 px too wide (`StructureImage`). Not seen at 390 px.
- Phone screens, minor: the search boxes' placeholder text is cut off.

## Waiting for Nitzan
1. Waste: which container acetic acid and hydrogen peroxide go in. Iodoform: the hand table says organic, the rule says halogenated organic; confirm with the lab.
2. Hydrogen peroxide: when possible, check the concentration on the lab's supplier SDS.

## Later phase
**Phase 2 – Compatibility matrix**, on hold ("coming soon" on the button) (reactive-group data for the demo chemicals, matrix screen, PDF export). Do not start until Nitzan approves.

## Not built yet
Settings screen (clear local data), offline app shell. NIOSH is not planned for now.
