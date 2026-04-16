import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

describe('Property test setup', () => {
  it('fast-check is configured correctly', () => {
    fc.assert(
      fc.property(fc.integer(), (n) => {
        expect(typeof n).toBe('number')
      })
    )
  })
})
