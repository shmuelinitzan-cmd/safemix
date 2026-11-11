# SafeMix

SafeMix is a browser-only web app (Vite + React + TypeScript + Tailwind, hosted on GitHub Pages) for lab preparation. A user searches a chemical by name or CAS and gets one compact card with exactly the columns of the lab's chemical table (name, formula, MW, BP, MP, density, vapour pressure, waste container, NFPA 704, exposure hazards by route), each value cited from an approved source. Cards go into a library and experiment tables, can be exported, and later are cross-checked in a compatibility matrix. **The card holds only those columns; the 16-section SDS format is out of scope (SPEC.md v2).** First target user: an academic chemistry / chemical-engineering teaching lab.

**The full spec is in [SPEC.md](SPEC.md). Read it before starting any work.**

## Core principle: grounded AI only (NON-NEGOTIABLE)

The AI never creates safety data. It only reorganizes, quotes and explains data that the app itself retrieved from approved sources or from a PDF the user uploaded. This is a hard requirement, enforced in code, not only in the prompt.

1. **No web access for the AI.** The AI model has no browsing or search tool. The app's own code fetches data from the approved APIs; the AI receives only that data.
2. **Context-only answers.** Every AI call receives a `context` object (retrieved records + uploaded PDF text). The system prompt forbids using any value not present in it.
3. **Every value cites its source.** The AI must return JSON where each field holds `value`, `source_id` and a short `quote` from the context.
4. **Code-level verification.** After each AI response, the app checks that every `quote` appears in the context and every number matches. Anything that fails is discarded and flagged, never shown as fact.
5. **Missing means missing.** If a field is not in the context, it stays empty with the label "No data from approved sources". The AI may not fill gaps from general knowledge.
6. **Wording vs. data.** The AI may suggest plain-English wording for text sections (e.g. handling advice), but only by rephrasing quoted source text. These suggestions are marked "AI-drafted, needs review".
7. **Human approval.** No field enters a saved card until the user accepts it.

## Rule: never invent chemical or safety data

Not in code, not in demo data, not in tests. If a value is not available from an approved source (see the table in SPEC.md), leave it empty and tell the user (Nitzan) explicitly which value is missing. Never fill a gap from general knowledge, memory or guesswork, even "obvious" values.

## Rule: one phase at a time

Work on one phase of the build plan (SPEC.md, "Build phases") at a time. When a phase is finished, stop and wait for Nitzan's explicit approval before starting the next one.

Also: before pushing anything to GitHub, ask Nitzan for the repository name.

## About the user

Nitzan is a chemical engineering student, not an experienced developer. At the end of each step, explain what you did in simple terms (plain language, no unexplained jargon), and give exact instructions for anything they need to run or click.
