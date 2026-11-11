// Values that Nitzan corrected by hand after checking a handbook. Applied when the demo
// cards are built. The value PubChem gave is kept on the field as `source_value`.
import type { CorrectionTable } from '../lib/cards.ts'

export const MANUAL_CORRECTIONS: CorrectionTable = {
  // Acetone. PubChem (HSDB, quoting CRC 95th ed.) says "0.7845 g/cu cm at 20 °C".
  '67-64-1': {
    density: {
      value: '0.7902 g/cm³ at 20 °C',
      note: 'Corrected after manual check against CRC Handbook 107th ed.',
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
