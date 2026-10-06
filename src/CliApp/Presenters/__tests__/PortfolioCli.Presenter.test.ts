import { beforeEach, describe, expect, it } from 'vitest'
import { Portfolio } from '@/Entities/Portfolio.Entity'
import { buildPortfolio, QDVE, SPYD } from '@/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '@/__fixtures__/console'
import { PortfolioCliPresenter, PresentMode } from '.././PortfolioCli.Presenter'

const COLUMN_ORDER = [
  'Tick',
  'Exchange',
  'Currency',
  'Price',
  'Shares',
  'Total Price',
  'Percentage %',
  'Target Percentage %',
  'Traded Shares',
  'Trading Price',
  'Trading Fee',
]

/** The example portfolio after `rebalance`: buy 27 QDVE, sell 13 SPYD. */
function buildRebalancedPortfolio(): Portfolio {
  const portfolio = buildPortfolio()
  portfolio.balanceForPrice(portfolio.totalPrice)
  return portfolio
}

function tableRows(spies: ConsoleSpies): Record<string, unknown>[] {
  expect(spies.table).toHaveBeenCalledTimes(1)
  return spies.table.mock.calls[0][0] as Record<string, unknown>[]
}

describe('PresentMode', () => {
  it('has stable numeric values', () => {
    expect(PresentMode.ONLY_NEW).toBe(0)
    expect(PresentMode.ONLY_INITIAL).toBe(1)
    expect(PresentMode.ONLY_DELTA).toBe(2)
    expect(PresentMode.WITH_DELTA).toBe(3)
  })
})

describe('PortfolioCliPresenter.present', () => {
  let spies: ConsoleSpies

  beforeEach(() => {
    spies = spyOnConsole()
  })

  it('defaults to ONLY_NEW and prints the proposed shares and portfolio price', () => {
    PortfolioCliPresenter.present(buildRebalancedPortfolio())

    expect(tableRows(spies)).toEqual([
      {
        'Tick': 'QDVE',
        'Exchange': 'IBIS2',
        'Currency': 'EUR',
        'Price': 28.45,
        'Shares': 127,
        'Total Price': 3613.15,
        'Percentage %': 40.08,
        'Target Percentage %': 40,
      },
      {
        'Tick': 'SPYD',
        'Exchange': 'IBIS2',
        'Currency': 'EUR',
        'Price': 62.1,
        'Shares': 87,
        'Total Price': 5402.7,
        'Percentage %': 59.92,
        'Target Percentage %': 60,
      },
    ])
    expect(printedLines(spies.log)).toEqual(['Portfolio Price: 9015.85 EUR', ''])
  })

  it('ONLY_INITIAL shows the current holdings and their value', () => {
    PortfolioCliPresenter.present(buildRebalancedPortfolio(), PresentMode.ONLY_INITIAL)

    const rows = tableRows(spies)
    expect(rows.map((row) => [row['Tick'], row['Shares'], row['Total Price'], row['Percentage %']]))
      .toEqual([
        ['QDVE', 100, 2845, 31.42],
        ['SPYD', 100, 6210, 68.58],
      ])
    expect(Object.keys(rows[0])).not.toContain('Traded Shares')
    expect(printedLines(spies.log)).toEqual(['Portfolio Price: 9055 EUR', ''])
  })

  it('ONLY_DELTA shows only the trades, their fees and the net traded price', () => {
    PortfolioCliPresenter.present(buildRebalancedPortfolio(), PresentMode.ONLY_DELTA)

    expect(tableRows(spies)).toEqual([
      {
        'Tick': 'QDVE',
        'Exchange': 'IBIS2',
        'Currency': 'EUR',
        'Price': 28.45,
        'Shares': 27,
        'Total Price': 768.15,
        // Current behaviour: the percentage is relative to the *net* traded price (-39.15),
        // so buys and sells that nearly cancel out produce huge, signed percentages.
        'Percentage %': -1962.07,
        'Target Percentage %': 40,
        'Trading Fee': 1,
      },
      {
        'Tick': 'SPYD',
        'Exchange': 'IBIS2',
        'Currency': 'EUR',
        'Price': 62.1,
        'Shares': -13,
        'Total Price': -807.3,
        'Percentage %': 2062.07,
        'Target Percentage %': 60,
        'Trading Fee': 1,
      },
    ])
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 2 EUR',
      'Trading Price: -39.15 EUR',
      '',
    ])
  })

  it('ONLY_DELTA leaves out securities that are not being traded', () => {
    const portfolio = buildPortfolio([{ ...QDVE, shares: 127, initialShares: 100 }, SPYD])

    PortfolioCliPresenter.present(portfolio, PresentMode.ONLY_DELTA)

    const rows = tableRows(spies)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ 'Tick': 'QDVE', 'Shares': 27, 'Percentage %': 100 })
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 1 EUR',
      'Trading Price: 768.15 EUR',
      '',
    ])
  })

  it('WITH_DELTA shows the proposed portfolio together with trades and fees', () => {
    PortfolioCliPresenter.present(buildRebalancedPortfolio(), PresentMode.WITH_DELTA)

    const rows = tableRows(spies)
    expect(rows).toEqual([
      {
        'Tick': 'QDVE',
        'Exchange': 'IBIS2',
        'Currency': 'EUR',
        'Price': 28.45,
        'Shares': 127,
        'Total Price': 3613.15,
        'Percentage %': 40.08,
        'Target Percentage %': 40,
        'Traded Shares': 27,
        'Trading Price': 768.15,
        'Trading Fee': 1,
      },
      {
        'Tick': 'SPYD',
        'Exchange': 'IBIS2',
        'Currency': 'EUR',
        'Price': 62.1,
        'Shares': 87,
        'Total Price': 5402.7,
        'Percentage %': 59.92,
        'Target Percentage %': 60,
        'Traded Shares': -13,
        'Trading Price': -807.3,
        'Trading Fee': 1,
      },
    ])
    expect(Object.keys(rows[0])).toEqual(COLUMN_ORDER)
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 2 EUR',
      'Trading Price: -39.15 EUR',
      'Portfolio Price: 9015.85 EUR',
      '',
    ])
  })

  it('orders the columns consistently, skipping the ones a mode does not have', () => {
    PortfolioCliPresenter.present(buildPortfolio(), PresentMode.ONLY_NEW)

    expect(Object.keys(tableRows(spies)[0])).toEqual(COLUMN_ORDER.slice(0, 8))
  })

  it('prints the title before the table when one is given', () => {
    PortfolioCliPresenter.present(buildPortfolio(), PresentMode.ONLY_INITIAL, 'My Portfolio')

    expect(printedLines(spies.log)).toEqual(['My Portfolio', 'Portfolio Price: 9055 EUR', ''])
    expect(spies.log.mock.invocationCallOrder[0]).toBeLessThan(
      spies.table.mock.invocationCallOrder[0],
    )
  })

  it('does not print an empty title', () => {
    PortfolioCliPresenter.present(buildPortfolio(), PresentMode.ONLY_INITIAL, '')

    expect(printedLines(spies.log)).toEqual(['Portfolio Price: 9055 EUR', ''])
  })

  describe('without exchange or currency', () => {
    const buildAnonymousPortfolio = () => {
      const portfolio = buildPortfolio([
        {
          ...QDVE, exchange: undefined, currency: undefined, shares: 127, initialShares: 100,
        },
        {
          ...SPYD, exchange: undefined, currency: undefined, shares: 87, initialShares: 100,
        },
      ])
      expect(portfolio.currency).toBeUndefined()
      return portfolio
    }

    it.each([
      [PresentMode.ONLY_NEW, ['Portfolio Price: 9015.85 ', '']],
      [PresentMode.ONLY_INITIAL, ['Portfolio Price: 9055 ', '']],
      [PresentMode.ONLY_DELTA, ['Trading Fee: 2 ', 'Trading Price: -39.15 ', '']],
      [
        PresentMode.WITH_DELTA,
        ['Trading Fee: 2 ', 'Trading Price: -39.15 ', 'Portfolio Price: 9015.85 ', ''],
      ],
    ])('mode %i shows "Unknown" in the table and no currency in the totals', (mode, lines) => {
      PortfolioCliPresenter.present(buildAnonymousPortfolio(), mode)

      const rows = tableRows(spies)
      expect(rows).toHaveLength(2)
      rows.forEach((row) => {
        expect(row['Exchange']).toBe('Unknown')
        expect(row['Currency']).toBe('Unknown')
      })
      // Current behaviour: the totals keep a trailing space where the currency would be.
      expect(printedLines(spies.log)).toEqual(lines)
    })
  })

  describe('with an unknown mode', () => {
    it('throws while building the table, before printing anything', () => {
      expect(() => PortfolioCliPresenter.present(buildPortfolio(), 99 as PresentMode))
        .toThrow('Unknown present mode \'99\'')
      expect(spies.table).not.toHaveBeenCalled()
      expect(spies.log).not.toHaveBeenCalled()
    })

    it('throws after printing the (empty) table when there are no securities', () => {
      // Current behaviour: the second unknown-mode check in present() is only reachable when
      // getTableData() never maps a security, which a constructed Portfolio does not allow.
      const portfolio = buildPortfolio()
      portfolio.securities = []

      expect(() => PortfolioCliPresenter.present(portfolio, 99 as PresentMode, 'Title'))
        .toThrow('Unknown present mode \'99\'')
      expect(spies.table).toHaveBeenCalledWith([])
      expect(printedLines(spies.log)).toEqual(['Title'])
    })
  })
})
