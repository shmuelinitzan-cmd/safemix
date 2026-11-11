// Waste-container suggestion: a FIXED, documented rule applied to the formula only.
// It is a suggestion; the user must confirm it against the lab's own instructions.
//
//  1. Formula contains carbon:
//       + any of F, Cl, Br, I  -> halogenated organic
//       otherwise              -> organic
//     (Limit: carbonates, CO2, cyanides also contain carbon and would be called organic.)
//  2. No carbon:
//       only H + one halogen (HF, HCl, HBr, HI)                         -> acidic inorganic
//       only H + one of N/S/P/Cl + at least 3 O, no metal (HNO3, H2SO4,
//         H3PO4, HClO4 pattern)                                         -> acidic inorganic
//       only H, O and alkali / alkaline-earth metal(s), H count = O count
//         (the M-OH hydroxide pattern)                                  -> basic
//       anything else                                                   -> inorganic
//  Limit: formula alone cannot see acidity of solutions (e.g. NH4OH counts as inorganic).
import type { WasteCategory } from '../types/card.ts'

// Manual override per chemical, keyed by CAS number. An entry here replaces the rule's
// suggestion for that chemical and is stored as set by the user. Filled by Nitzan from the
// lab's own waste instructions; left empty until then (nothing is assumed).
export const WASTE_OVERRIDES: Record<string, WasteCategory> = {}

const HALOGENS = ['F', 'Cl', 'Br', 'I']
const ALKALI_EARTH = ['Li', 'Na', 'K', 'Rb', 'Cs', 'Mg', 'Ca', 'Sr', 'Ba']

export function parseFormula(formula: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [, el, n] of formula.matchAll(/([A-Z][a-z]?)(\d*)/g)) out[el] = (out[el] ?? 0) + (n ? Number(n) : 1)
  return out
}

export function suggestWaste(formula: string): { category: WasteCategory; reason: string } {
  const el = parseFormula(formula)
  const names = Object.keys(el)
  if (el.C) {
    return names.some((e) => HALOGENS.includes(e))
      ? { category: 'halogenated organic', reason: 'contains carbon and a halogen' }
      : { category: 'organic', reason: 'contains carbon' }
  }
  const halogens = names.filter((e) => HALOGENS.includes(e))
  if (names.length === 2 && el.H && halogens.length === 1)
    return { category: 'acidic inorganic', reason: 'hydrogen halide pattern (H + halogen only)' }
  const centre = names.filter((e) => ['N', 'S', 'P', 'Cl'].includes(e))
  if (names.length === 3 && el.H && el.O >= 3 && centre.length === 1)
    return { category: 'acidic inorganic', reason: 'oxoacid pattern (H + N/S/P/Cl + at least 3 O)' }
  const metals = names.filter((e) => ALKALI_EARTH.includes(e))
  if (metals.length >= 1 && names.length === metals.length + 2 && el.H && el.O && el.H === el.O)
    return { category: 'basic', reason: 'metal hydroxide pattern (alkali / alkaline-earth metal + OH)' }
  return { category: 'inorganic', reason: 'no carbon and no acid / base pattern matched' }
}
