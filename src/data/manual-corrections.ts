// Values that Nitzan corrected by hand after checking a handbook. Applied when the demo
// cards are built. The value PubChem gave is kept on the field as `source_value`.
import type { CorrectionTable } from '../lib/cards.ts'

// Demo cards with something that could not be verified, by CAS number.
export const DEMO_NOT_VERIFIED: Record<string, string> = {
  // Hydrogen peroxide: which concentration the demo values belong to.
  '7722-84-1': 'Concentration not verified',
}

export const MANUAL_CORRECTIONS: CorrectionTable = {
  // Acetone. PubChem (HSDB, quoting CRC 95th ed.) says "0.7845 g/cu cm at 20 °C".
  '67-64-1': {
    density: {
      value: '0.7902 g/cm³ at 20 °C',
      note: 'Corrected after manual check against CRC Handbook 107th ed.',
      reference: 'CRC Handbook 107th ed.',
    },
  },
  // Acetic acid. PubChem's record title is "Acetic Acid"; the lab uses the glacial grade.
  '64-19-7': {
    name: {
      value: 'Acetic acid (glacial)',
      note: 'Renamed by hand to name the glacial grade (PubChem title: "Acetic Acid").',
    },
  },
}
