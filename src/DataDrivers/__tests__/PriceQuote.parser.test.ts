import { describe, expect, it } from 'vitest'
import { parsePriceQuote } from '../PriceQuote.parser'

describe('parsePriceQuote', () => {
  it('parses a plain price and currency', () => {
    expect(parsePriceQuote('28.45', 'EUR')).toEqual({ price: 28.45, currency: 'EUR' })
  })

  it('accepts an integer price', () => {
    expect(parsePriceQuote('62', 'EUR')).toEqual({ price: 62, currency: 'EUR' })
  })

  it.each([
    ['thousands commas', '1,234,567.89', 1234567.89],
    ['spaces', ' 1 234.5 ', 1234.5],
    ['no-break spaces (U+00A0)', '1\u00a0234.5\u00a0', 1234.5],
    ['narrow no-break spaces (U+202F)', '\u202f1\u202f234.5', 1234.5],
    ['tabs and newlines', '\n\t1,234.5\n', 1234.5],
  ])('strips %s from the price', (_case, text, price) => {
    expect(parsePriceQuote(text, 'EUR').price).toBe(price)
  })

  it('trims the currency, including no-break spaces', () => {
    expect(parsePriceQuote('1', '\u00a0 EUR\u202f\n').currency).toBe('EUR')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace only', ' \u00a0\u202f\n'],
    ['commas only', ',,'],
  ])('throws "No price text found" for a %s price', (_case, text) => {
    expect(() => parsePriceQuote(text, 'EUR')).toThrow(/^No price text found$/)
  })

  it.each([
    ['zero', '0'],
    ['zero with decimals', '0.00'],
    ['negative', '-1.5'],
    ['non-numeric', 'N/A'],
    ['a number with a unit', '28.45EUR'],
    ['exponent notation', '1e3'],
    ['hexadecimal', '0x1F'],
    ['Infinity', 'Infinity'],
    ['two decimal points', '1.2.3'],
    ['a trailing decimal point', '12.'],
    ['too large to be finite', '9'.repeat(400)],
  ])('throws for a %s price', (_case, text) => {
    expect(() => parsePriceQuote(text, 'EUR'))
      .toThrow(`Price '${text}' is not a positive number`)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace only', ' \u00a0\n'],
  ])('throws "No currency text found" for a %s currency', (_case, text) => {
    expect(() => parsePriceQuote('28.45', text)).toThrow(/^No currency text found$/)
  })

  it('checks the price before the currency', () => {
    expect(() => parsePriceQuote(null, null)).toThrow('No price text found')
  })
})
