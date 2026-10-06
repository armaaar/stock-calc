import { describe, expect, it } from 'vitest'
import { roundPercentage, roundToClosestMultiply, sortObjectByKey } from '.././utils'

describe('roundToClosestMultiply', () => {
  it.each([
    [7, 5, 5],
    [8, 5, 10],
    [7.5, 5, 10],
    [0, 5, 0],
    [2, 5, 0],
    [3, 1, 3],
    [12, 4, 12],
  ])('rounds %d to the closest multiple of %d (%d)', (num, step, expected) => {
    expect(roundToClosestMultiply(num, step)).toBe(expected)
  })
})

describe('roundPercentage', () => {
  it.each([
    [0.31419, 31.42],
    [0.4073, 40.73],
    [1, 100],
    [0, 0],
    [0.00005, 0.01],
    [-0.12346, -12.35],
  ])('converts the fraction %d to a percentage with two decimals (%d)', (fraction, expected) => {
    expect(roundPercentage(fraction)).toBe(expected)
  })
})

describe('sortObjectByKey', () => {
  it('orders the keys as given', () => {
    const sorted = sortObjectByKey({ c: 3, a: 1, b: 2 }, ['a', 'b', 'c'])

    expect(Object.keys(sorted)).toEqual(['a', 'b', 'c'])
    expect(sorted).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('drops keys whose value is undefined but keeps other falsy values', () => {
    const sorted = sortObjectByKey(
      {
        a: undefined, b: null, c: 0, d: '',
      } as Record<string, unknown>,
      ['a', 'b', 'c', 'd'],
    )

    expect(sorted).toEqual({ b: null, c: 0, d: '' })
    expect('a' in sorted).toBe(false)
  })

  it('drops keys that are not listed', () => {
    expect(sortObjectByKey({ a: 1, b: 2 }, ['b'])).toEqual({ b: 2 })
  })

  it('does not mutate the input', () => {
    const input = { b: 2, a: 1 }

    sortObjectByKey(input, ['a'])

    expect(input).toEqual({ b: 2, a: 1 })
  })
})
