import { describe, expect, it } from 'vitest'
import { Command } from '@commander-js/extra-typings'
import { portfolioOption } from '.././cliOptions'

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
      // Current behaviour: README/docs still show `-pt`, which is now parsed as `-p -t`.
      expect(() => parse(['-pt', 'EGP'])).toThrow('unknown option \'-pt\'')
    })

    it('requires a value', () => {
      expect(() => parse(['--pt'])).toThrow('option \'--pt, --portfolio <type>\' argument missing')
    })
  })
})
