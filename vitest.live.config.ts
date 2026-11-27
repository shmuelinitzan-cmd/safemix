// Only for `npm run test:live`, which contacts the real PubChem. `npm test` does not use this.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { include: ['src/**/*.live.ts'], fileParallelism: false, testTimeout: 120_000 },
})
