// An experiment = a named list of library chemicals shown as one table, one row per chemical.
export interface Experiment {
  id: string
  name: string
  // Library card ids, in the order the rows appear.
  card_ids: string[]
  created_at: string
  updated_at: string
}
