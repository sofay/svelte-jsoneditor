import { strictEqual } from 'assert'
import { isDigit } from './numberUtils.js'

describe('numberUtils', () => {
  it('isDigit', () => {
    strictEqual(isDigit('0'), true)
    strictEqual(isDigit('5'), true)
    strictEqual(isDigit('9'), true)
    strictEqual(isDigit('a'), false)
    strictEqual(isDigit('111'), false)
    strictEqual(isDigit(''), false)
  })
})
