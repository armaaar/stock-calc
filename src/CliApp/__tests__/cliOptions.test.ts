import { describe, expect, it } from 'vitest'
import { Command, InvalidArgumentError } from '@commander-js/extra-typings'
import { parseFiniteNumber, parsePortfolioId, portfolioOption } from '../cliOptions'

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

const INVALID = 'Invalid portfolio: use <broker>/<portfolio>, each made of letters, digits, '
  + '\'_\' or \'-\' and starting with a letter or digit.'

describe('parsePortfolioId', () => {
  it.each(['ibkr/eur', 'thndr/EGP', 'my-broker/TMP_2', '0/1'])('accepts %j', (value) => {
    expect(parsePortfolioId(value)).toBe(value)
  })

  it.each([
    '', 'EUR', 'ibkr/', '/eur', 'a/b/c', '../eur', 'ibkr/../eur', 'ibkr/eur.old', 'ibkr/my eur',
    'ibkr/_broker', '_x/eur', 'ibkr\\eur',
  ])(
    'rejects %j with an InvalidArgumentError',
    (value) => {
      expect(() => parsePortfolioId(value)).toThrow(InvalidArgumentError)
      expect(() => parsePortfolioId(value)).toThrow(INVALID)
    },
  )
})

describe('portfolioOption', () => {
  const FLAGS = '--pt, --portfolio <broker/portfolio>'

  it('accepts both --pt and --portfolio with a required <broker/portfolio> value', () => {
    expect(portfolioOption.flags).toBe(FLAGS)
    expect(portfolioOption.short).toBe('--pt')
    expect(portfolioOption.long).toBe('--portfolio')
    expect(portfolioOption.required).toBe(true)
    expect(portfolioOption.description).toBe(
      'the portfolio to use, e.g. ibkr/eur (default: the only portfolio in the data folder)',
    )
  })

  it('stores its value as `portfolio` and has no default', () => {
    expect(portfolioOption.attributeName()).toBe('portfolio')
    expect(portfolioOption.defaultValue).toBeUndefined()
  })

  describe('when parsed', () => {
    const parse = (args: string[]) => new Command()
      .exitOverride()
      .configureOutput({ writeErr: () => {} })
      .addOption(portfolioOption)
      .parse(args, { from: 'user' })
      .opts()

    it('leaves the portfolio out when not given', () => {
      expect(parse([])).toEqual({})
    })

    it.each([
      [['--pt', 'thndr/egp']],
      [['--portfolio', 'thndr/egp']],
      [['--portfolio=thndr/egp']],
    ])('reads the portfolio from %j', (args) => {
      expect(parse(args)).toEqual({ portfolio: 'thndr/egp' })
    })

    it('rejects the old single-dash -pt form', () => {
      // commander 15 only allows single-character short flags, so `-pt` is `-p -t`
      expect(() => parse(['-pt', 'thndr/egp'])).toThrow('unknown option \'-pt\'')
    })

    it('rejects a value that is not a portfolio id', () => {
      expect(() => parse(['--pt', '../secrets'])).toThrow(
        `option '${FLAGS}' argument '../secrets' is invalid. ${INVALID}`,
      )
    })

    it('requires a value', () => {
      expect(() => parse(['--pt'])).toThrow(`option '${FLAGS}' argument missing`)
    })
  })
})
