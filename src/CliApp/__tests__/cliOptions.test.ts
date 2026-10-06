import { describe, expect, it } from 'vitest'
import { Command, InvalidArgumentError } from '@commander-js/extra-typings'
import { parseFiniteNumber, parsePortfolioName, portfolioOption } from '../cliOptions'

describe('parseFiniteNumber', () => {
  it.each([
    ['1000', 1000],
    ['250.5', 250.5],
    ['-100', -100],
    ['1e4', 10000],
    [' 7 ', 7],
    ['0', 0],
  ])('converts %j to %d', (value, expected) => {
    expect(parseFiniteNumber(value)).toBe(expected)
  })

  it.each(['abc', '12abc', 'NaN', 'Infinity', '-Infinity', '1e999', '', '   '])(
    'rejects %j with an InvalidArgumentError',
    (value) => {
      expect(() => parseFiniteNumber(value)).toThrow(InvalidArgumentError)
      expect(() => parseFiniteNumber(value)).toThrow('Not a finite number.')
    },
  )
})

describe('parsePortfolioName', () => {
  it.each(['EUR', 'egp', 'TMP_2', 'my-portfolio'])('accepts %j', (value) => {
    expect(parsePortfolioName(value)).toBe(value)
  })

  it.each(['', '../EUR', 'EUR.old', 'my portfolio', 'a/b'])(
    'rejects %j with an InvalidArgumentError',
    (value) => {
      expect(() => parsePortfolioName(value)).toThrow(InvalidArgumentError)
      expect(() => parsePortfolioName(value)).toThrow('Use letters, digits, \'_\' or \'-\'.')
    },
  )
})

describe('portfolioOption', () => {
  it('accepts both --pt and --portfolio with a required <type> value', () => {
    expect(portfolioOption.flags).toBe('--pt, --portfolio <type>')
    expect(portfolioOption.short).toBe('--pt')
    expect(portfolioOption.long).toBe('--portfolio')
    expect(portfolioOption.required).toBe(true)
    expect(portfolioOption.description).toBe('the portfolio to use')
  })

  it('stores its value as `portfolio` and defaults to EUR', () => {
    expect(portfolioOption.attributeName()).toBe('portfolio')
    expect(portfolioOption.defaultValue).toBe('EUR')
  })

  describe('when parsed', () => {
    const parse = (args: string[]) => new Command()
      .exitOverride()
      .configureOutput({ writeErr: () => {} })
      .addOption(portfolioOption)
      .parse(args, { from: 'user' })
      .opts()

    it('defaults to EUR', () => {
      expect(parse([])).toEqual({ portfolio: 'EUR' })
    })

    it.each([
      [['--pt', 'EGP']],
      [['--portfolio', 'EGP']],
      [['--portfolio=EGP']],
    ])('reads the type from %j', (args) => {
      expect(parse(args)).toEqual({ portfolio: 'EGP' })
    })

    it('rejects the old single-dash -pt form', () => {
      // commander 15 only allows single-character short flags, so `-pt` is `-p -t`
      expect(() => parse(['-pt', 'EGP'])).toThrow('unknown option \'-pt\'')
    })

    it('rejects a type that is not a valid portfolio name', () => {
      expect(() => parse(['--pt', '../secrets'])).toThrow(
        'option \'--pt, --portfolio <type>\' argument \'../secrets\' is invalid. '
        + 'Use letters, digits, \'_\' or \'-\'.',
      )
    })

    it('requires a value', () => {
      expect(() => parse(['--pt'])).toThrow('option \'--pt, --portfolio <type>\' argument missing')
    })
  })
})
