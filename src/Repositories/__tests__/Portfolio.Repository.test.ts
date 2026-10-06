import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import type {
  IExchangeRateDataDriver, IOverridesDataDriver, IPriceDataDriver, ISettingsDataDriver,
  SecurityPriceDto,
} from '#src/DataDrivers/DataDrivers.type'
import {
  EUR_OVERRIDES, EUR_SETTINGS, priceOverrides, QDVE_SETTING, SPYD_SETTING, withoutIsin,
} from '#src/__fixtures__/dataFiles'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'
import { PortfolioRepository } from '../Portfolio.Repository'

/** Finds every requested portfolio (`ibkr/eur` when none is) and reads `EUR_SETTINGS` for it. */
function fakeSettingsDataDriver() {
  return {
    resolvePortfolioId: vi.fn<ISettingsDataDriver['resolvePortfolioId']>()
      .mockImplementation(async (requested) => requested ?? 'ibkr/eur'),
    getPortfolioSettings: vi.fn<ISettingsDataDriver['getPortfolioSettings']>()
      .mockResolvedValue(EUR_SETTINGS),
  } satisfies ISettingsDataDriver
}

/** No overrides for any portfolio. */
function fakeOverridesDataDriver() {
  return {
    getPortfolioOverrides: vi.fn<IOverridesDataDriver['getPortfolioOverrides']>()
      .mockResolvedValue(priceOverrides({})),
  } satisfies IOverridesDataDriver
}

/**
 * A price and exchange-rate source that can't price or convert anything; its browser launches
 * and closes fine.
 */
function fakePriceDataDriver(name: string) {
  return {
    name,
    getPrice: vi.fn<IPriceDataDriver['getPrice']>()
      .mockRejectedValue(Error(`${name}: not found`)),
    getRate: vi.fn<IExchangeRateDataDriver['getRate']>()
      .mockRejectedValue(Error(`${name}: no rate`)),
    launchBrowser: vi.fn<IPriceDataDriver['launchBrowser']>().mockResolvedValue(undefined),
    closeBrowser: vi.fn<IPriceDataDriver['closeBrowser']>().mockResolvedValue(undefined),
  } satisfies IPriceDataDriver & IExchangeRateDataDriver
}

type FakePriceDataDriver = ReturnType<typeof fakePriceDataDriver>

const EUR = (price: number): SecurityPriceDto => ({ price, currency: 'EUR' })

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const firstCall = (fn: { mock: { invocationCallOrder: number[] } }) => (
  fn.mock.invocationCallOrder[0]
)

describe('PortfolioRepository', () => {
  let settings: ReturnType<typeof fakeSettingsDataDriver>
  let overrides: ReturnType<typeof fakeOverridesDataDriver>
  let justEtf: FakePriceDataDriver
  let tradingView: FakePriceDataDriver
  let repository: PortfolioRepository

  /**
   * A repository over the shared settings / overrides fakes and the given price drivers, with
   * no rate source unless some are given.
   */
  const repositoryWith = (
    prices: IPriceDataDriver[],
    rates: IExchangeRateDataDriver[] = [],
  ) => new PortfolioRepository({
    settings, overrides, prices, rates,
  })

  function expectBrowsersClosed() {
    expect(justEtf.closeBrowser).toHaveBeenCalledOnce()
    expect(tradingView.closeBrowser).toHaveBeenCalledOnce()
  }

  beforeEach(() => {
    settings = fakeSettingsDataDriver()
    overrides = fakeOverridesDataDriver()
    justEtf = fakePriceDataDriver('justetf')
    tradingView = fakePriceDataDriver('tradingview')
    repository = repositoryWith([justEtf, tradingView])
  })

  describe('data files', () => {
    it('reads settings and overrides for the requested portfolio', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      await repository.getPortfolio('thndr/egp')

      expect(settings.resolvePortfolioId).toHaveBeenCalledWith('thndr/egp')
      expect(settings.getPortfolioSettings).toHaveBeenCalledWith('thndr/egp')
      expect(overrides.getPortfolioOverrides).toHaveBeenCalledWith('thndr/egp')
    })

    it('reads the portfolio the settings driver resolves when none is requested', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      await repository.getPortfolio()

      expect(settings.resolvePortfolioId).toHaveBeenCalledWith(undefined)
      expect(settings.getPortfolioSettings).toHaveBeenCalledWith('ibkr/eur')
      expect(overrides.getPortfolioOverrides).toHaveBeenCalledWith('ibkr/eur')
    })

    it('reads nothing when the portfolio cannot be resolved', async () => {
      settings.resolvePortfolioId.mockRejectedValue(Error('Choose a portfolio.'))

      await expect(repository.getPortfolio()).rejects.toThrow('Choose a portfolio.')

      expect(settings.getPortfolioSettings).not.toHaveBeenCalled()
      expect(overrides.getPortfolioOverrides).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('reads them again on every load (nothing is cached)', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const first = await repository.getPortfolio('ibkr/eur')
      const second = await repository.getPortfolio('thndr/egp')

      expect(first).not.toBe(second)
      expect(settings.getPortfolioSettings.mock.calls).toEqual([['ibkr/eur'], ['thndr/egp']])
      expect(overrides.getPortfolioOverrides.mock.calls).toEqual([['ibkr/eur'], ['thndr/egp']])
    })
  })

  describe('price resolution', () => {
    it('uses overrides and never calls the scrapers for overridden ticks', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repository.getPortfolio('ibkr/eur')

      expect(justEtf.getPrice).not.toHaveBeenCalled()
      expect(tradingView.getPrice).not.toHaveBeenCalled()
      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
    })

    it('scrapes only the ticks that are not overridden', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: EUR_OVERRIDES.prices.QDVE,
      }))
      tradingView.getPrice.mockResolvedValue(EUR(62.1))

      const portfolio = await repository.getPortfolio('ibkr/eur')

      expect(justEtf.getPrice.mock.calls).toEqual([[SPYD_SETTING]])
      expect(tradingView.getPrice.mock.calls).toEqual([[SPYD_SETTING]])
      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
    })

    it('an override wins even when a scraper could price the security', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: EUR(1),
        SPYD: EUR(2),
      }))
      justEtf.getPrice.mockResolvedValue(EUR(999))

      const portfolio = await repository.getPortfolio('ibkr/eur')

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([1, 2])
    })

    it('asks every source with the full setting, but prefers the first in the list', async () => {
      // tradingview answers first, but justetf comes first in the list and can price both
      const justEtfPrice = deferred<SecurityPriceDto>()
      justEtf.getPrice.mockReturnValue(justEtfPrice.promise)
      tradingView.getPrice.mockResolvedValue(EUR(30))

      const result = repository.getPortfolio('ibkr/eur')
      setTimeout(() => justEtfPrice.resolve(EUR(10)), 0)
      const portfolio = await result

      expect(justEtf.getPrice.mock.calls).toEqual([[QDVE_SETTING], [SPYD_SETTING]])
      expect(tradingView.getPrice.mock.calls).toEqual([[QDVE_SETTING], [SPYD_SETTING]])
      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([10, 10])
      expect(portfolio.securities.map((s) => s.quote.source))
        .toEqual(['justetf', 'justetf'])
    })

    it('falls back to the next source when the preferred one fails', async () => {
      const tradingViewPrice = deferred<SecurityPriceDto>()
      justEtf.getPrice.mockRejectedValue(Error('justetf: not found'))
      tradingView.getPrice.mockReturnValue(tradingViewPrice.promise)

      const result = repository.getPortfolio('ibkr/eur')
      setTimeout(() => tradingViewPrice.resolve(EUR(40)), 0)
      const portfolio = await result

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([40, 40])
    })

    it('picks the source per security, and records it on the quote', async () => {
      justEtf.getPrice.mockImplementation(async ({ tick }) => {
        if (tick === 'QDVE') return EUR(28.45)
        throw Error('justetf: not found')
      })
      tradingView.getPrice.mockResolvedValue(EUR(62.1))

      const portfolio = await repository.getPortfolio('ibkr/eur')

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
      expect(portfolio.securities.map((s) => s.quote.source)).toEqual(['justetf', 'tradingview'])
    })

    it('dates a live price by the source\'s own date when it gives one, such as a NAV\'s', async () => {
      justEtf.getPrice.mockImplementation(async ({ tick }) => (
        tick === 'QDVE' ? { ...EUR(10), quotedAt: '2026-10-05' } : EUR(20)
      ))

      const portfolio = await new PortfolioRepository(
        {
          settings, overrides, prices: [justEtf], rates: [],
        },
        () => new Date('2026-10-06T09:30:00Z'),
      ).getPortfolio('ibkr/eur')

      expect(portfolio.securities.map((s) => s.quote.quotedAt))
        .toEqual(['2026-10-05', '2026-10-06T09:30:00.000Z'])
    })

    it('time-stamps live prices with the injected clock', async () => {
      const now = new Date('2026-10-06T09:30:00Z')
      justEtf.getPrice.mockResolvedValue(EUR(10))

      const portfolio = await new PortfolioRepository(
        {
          settings, overrides, prices: [justEtf], rates: [],
        },
        () => now,
      ).getPortfolio('ibkr/eur')

      expect(portfolio.securities.map((s) => s.quote.quotedAt))
        .toEqual(['2026-10-06T09:30:00.000Z', '2026-10-06T09:30:00.000Z'])
    })

    it('time-stamps live prices with the current time by default', async () => {
      justEtf.getPrice.mockResolvedValue(EUR(10))
      const before = Date.now()

      const portfolio = await repository.getPortfolio('ibkr/eur')

      const quotedAt = Date.parse(portfolio.securities[0].quote.quotedAt as string)
      expect(quotedAt).toBeGreaterThanOrEqual(before)
      expect(quotedAt).toBeLessThanOrEqual(Date.now())
    })

    it('marks overridden prices as overrides, dated by their optional asOf', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: { ...EUR_OVERRIDES.prices.QDVE, asOf: '2026-10-01' },
        SPYD: EUR_OVERRIDES.prices.SPYD,
      }))

      const [qdve, spyd] = (await repository.getPortfolio('ibkr/eur')).securities

      expect(qdve.quote.source).toBe('override')
      expect(qdve.quote.quotedAt).toBe('2026-10-01')
      expect(spyd.quote.source).toBe('override')
      expect(spyd.quote.quotedAt).toBeUndefined()
    })

    it('rejects with an AggregateError of every source error when all sources fail', async () => {
      const justEtfError = Error('justetf: not found')
      const tradingViewError = Error('tradingview: not found')
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS, securities: [QDVE_SETTING],
      })
      justEtf.getPrice.mockRejectedValue(justEtfError)
      tradingView.getPrice.mockRejectedValue(tradingViewError)

      const error = await repository.getPortfolio('ibkr/eur').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).message).toBe(
        'No price source could price \'QDVE\': check its tick, exchange and isin, '
        + 'or add its price to the overrides',
      )
      expect((error as AggregateError).errors).toEqual([justEtfError, tradingViewError])
    })

    it('lists the source errors in the order of the prices list', async () => {
      const justEtfError = Error('justetf: not found')
      const tradingViewError = Error('tradingview: not found')
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS, securities: [QDVE_SETTING],
      })
      justEtf.getPrice.mockRejectedValue(justEtfError)
      tradingView.getPrice.mockRejectedValue(tradingViewError)

      const error = await repositoryWith([tradingView, justEtf]).getPortfolio('ibkr/eur')
        .catch((e: unknown) => e)

      expect((error as AggregateError).errors).toEqual([tradingViewError, justEtfError])
    })

    it('one unpriceable security fails the whole portfolio', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: EUR_OVERRIDES.prices.QDVE,
      }))

      await expect(repository.getPortfolio('ibkr/eur')).rejects.toBeInstanceOf(AggregateError)
    })

    it('scrapes a tick named like an Object.prototype member instead of overriding it', async () => {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        securities: [{ ...QDVE_SETTING, tick: 'toString', targetPercentage: 1 }],
      })
      justEtf.getPrice.mockResolvedValue(EUR(28.45))

      const portfolio = await repository.getPortfolio('ibkr/eur')

      expect(portfolio.securities[0].price.toNumber()).toBe(28.45)
      expect(justEtf.getPrice).toHaveBeenCalledOnce()
    })
  })

  describe('injected price data drivers', () => {
    it('prices every security from a single price driver', async () => {
      justEtf.getPrice.mockImplementation(async ({ tick }) => (
        tick === 'QDVE' ? EUR(28.45) : EUR(62.1)
      ))

      const portfolio = await repositoryWith([justEtf]).getPortfolio('ibkr/eur')

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
      expect(justEtf.launchBrowser).toHaveBeenCalledOnce()
      expect(justEtf.closeBrowser).toHaveBeenCalledOnce()
      expect(tradingView.launchBrowser).not.toHaveBeenCalled()
      expect(tradingView.getPrice).not.toHaveBeenCalled()
      expect(tradingView.closeBrowser).not.toHaveBeenCalled()
    })

    it('rejects with the single driver\'s error alone when it cannot price a security', async () => {
      const justEtfError = Error('justetf: not found')
      justEtf.getPrice.mockRejectedValue(justEtfError)

      const error = await repositoryWith([justEtf]).getPortfolio('ibkr/eur').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors).toEqual([justEtfError])
      expect(justEtf.closeBrowser).toHaveBeenCalledOnce()
    })

    it('works without any price driver when every price is overridden', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repositoryWith([]).getPortfolio('ibkr/eur')

      expect(portfolio.totalPrice.toNumber()).toBe(9055)
    })

    it('names the un-overridden security when there is no price driver', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: EUR_OVERRIDES.prices.QDVE,
      }))

      await expect(repositoryWith([]).getPortfolio('ibkr/eur'))
        .rejects.toThrow('No price source for \'SPYD\': add its price to the overrides')
    })

    it('asks a third price driver alongside the others', async () => {
      const third = fakePriceDataDriver('third')
      third.getPrice.mockResolvedValue(EUR(50))

      const portfolio = await repositoryWith([justEtf, tradingView, third]).getPortfolio('ibkr/eur')

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([50, 50])
      expect(third.getPrice.mock.calls).toEqual([[QDVE_SETTING], [SPYD_SETTING]])
      expect(third.launchBrowser).toHaveBeenCalledOnce()
      expect(third.closeBrowser).toHaveBeenCalledOnce()
      expectBrowsersClosed()
    })
  })

  describe('building the Portfolio', () => {
    it('returns a Portfolio with the settings and prices of every security', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repository.getPortfolio('ibkr/eur')

      expect(portfolio).toBeInstanceOf(Portfolio)
      expect(portfolio.currency).toBe('EUR')
      expect(portfolio.totalPrice.toNumber()).toBe(9055)
      expect(portfolio.securities).toHaveLength(2)
      portfolio.securities.forEach((security, i) => {
        const setting = EUR_SETTINGS.securities[i]
        expect(security).toBeInstanceOf(PortfolioSecurity)
        expect(security).toMatchObject({
          tick: setting.tick,
          isin: setting.isin,
          exchange: setting.exchange,
          currency: 'EUR',
          shares: setting.shares,
          initialShares: setting.shares,
        })
        expect(security.price.toNumber()).toBe(EUR_OVERRIDES.prices[setting.tick].price)
        expect(security.targetPercentage.toNumber()).toBe(setting.targetPercentage)
      })
    })

    it('copies the portfolio fees to every security that does not set its own', async () => {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        brokerageFeeFlat: 2.5,
        tradingFeePercentage: 0.001,
        minimumTradingFeeFlat: 3,
      })
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repository.getPortfolio('ibkr/eur')

      portfolio.securities.forEach((security) => {
        expect(security.brokerageFeeFlat.toNumber()).toBe(2.5)
        expect(security.tradingFeePercentage.toNumber()).toBe(0.001)
        expect(security.minimumTradingFeeFlat.toNumber()).toBe(3)
      })
    })

    it('passes the cash held to the portfolio, or none when the settings have none', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      expect((await repository.getPortfolio('ibkr/eur')).cash.toNumber()).toBe(0)

      settings.getPortfolioSettings.mockResolvedValue({ ...EUR_SETTINGS, cash: 321.5 })
      expect((await repository.getPortfolio('ibkr/eur')).cash.toNumber()).toBe(321.5)
    })

    it('passes the fee warning percentage, or leaves the default', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      expect((await repository.getPortfolio('ibkr/eur')).feeWarningPercentage.toNumber()).toBe(0.01)

      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS, feeWarningPercentage: 0.02,
      })
      expect((await repository.getPortfolio('ibkr/eur')).feeWarningPercentage.toNumber()).toBe(0.02)
    })

    it('uses the fee parts a security sets, falling back to the portfolio fees part by part', async () => {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        brokerageFeeFlat: 3,
        tradingFeePercentage: 0.001,
        minimumTradingFeeFlat: 1,
        securities: [
          { ...QDVE_SETTING, brokerageFeeFlat: 3.56, minimumTradingFeeFlat: 0 },
          SPYD_SETTING,
        ],
      })
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const [qdve, spyd] = (await repository.getPortfolio('ibkr/eur')).securities

      expect(qdve.brokerageFeeFlat.toNumber()).toBe(3.56)
      expect(qdve.tradingFeePercentage.toNumber()).toBe(0.001)
      expect(qdve.minimumTradingFeeFlat.toNumber()).toBe(0)
      expect(spyd.brokerageFeeFlat.toNumber()).toBe(3)
      expect(spyd.tradingFeePercentage.toNumber()).toBe(0.001)
      expect(spyd.minimumTradingFeeFlat.toNumber()).toBe(1)
    })

    it.each([
      ['brokerageFeeFlat', 3],
      ['tradingFeePercentage', 0.002],
      ['minimumTradingFeeFlat', 5],
    ] as const)('keeps a %s override of 0 instead of falling back', async (part, portfolioFee) => {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        [part]: portfolioFee,
        securities: [{ ...QDVE_SETTING, [part]: 0 }, SPYD_SETTING],
      })
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const [qdve, spyd] = (await repository.getPortfolio('ibkr/eur')).securities

      expect(qdve[part].toNumber()).toBe(0)
      expect(spyd[part].toNumber()).toBe(portfolioFee)
    })

    it('keeps an undefined isin for securities without one', async () => {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        securities: [withoutIsin(QDVE_SETTING), SPYD_SETTING],
      })
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repository.getPortfolio('ibkr/eur')

      expect(portfolio.securities[0].isin).toBeUndefined()
    })

    it('takes the currency from the price quote', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: { price: 28.45, currency: 'USD' },
        SPYD: { price: 62.1, currency: 'USD' },
      }))

      const portfolio = await repository.getPortfolio('ibkr/eur')

      expect(portfolio.currency).toBe('USD')
    })

    it('propagates Portfolio invariant errors (mixed currencies)', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: { price: 28.45, currency: 'EUR' },
        SPYD: { price: 62.1, currency: 'USD' },
      }))

      await expect(repository.getPortfolio('ibkr/eur'))
        .rejects.toThrow('Portfolio in EUR has securities priced in other currencies (QDVE: EUR, SPYD: USD)')
      // Without a portfolio currency, nothing is converted, so no rate is asked for
      expect(tradingView.getRate).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('names the portfolio by its id', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      expect((await repository.getPortfolio('thndr/egp')).id).toBe('thndr/egp')
      expect((await repository.getPortfolio()).id).toBe('ibkr/eur')
    })
  })

  describe('a security traded in a set currency', () => {
    const SPYD_USD = { ...SPYD_SETTING, currency: 'USD' }

    beforeEach(() => {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS, currency: 'EUR', securities: [QDVE_SETTING, SPYD_USD],
      })
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: EUR_OVERRIDES.prices.QDVE,
      }))
      tradingView.getRate.mockResolvedValue(0.9)
    })

    it('skips a source that quotes another listing, and takes the next one', async () => {
      justEtf.getPrice.mockResolvedValue(EUR(62.1))
      tradingView.getPrice.mockResolvedValue({ price: 69, currency: 'USD' })

      const spyd = (await repositoryWith([justEtf, tradingView], [tradingView])
        .getPortfolio('ibkr/eur')).securities[1]

      expect(spyd.quote.currency).toBe('USD')
      expect(spyd.quote.source).toBe('tradingview')
      expect(spyd.exchangeRate?.rate.toNumber()).toBe(0.9)
      expect(spyd.price.toNumber()).toBe(62.1)
    })

    it('reports the sources that quoted another currency when none quotes it in its own', async () => {
      justEtf.getPrice.mockResolvedValue(EUR(62.1))

      const error = await repositoryWith([justEtf, tradingView], [tradingView])
        .getPortfolio('ibkr/eur').catch((e: unknown) => e)

      expect((error as AggregateError).message).toBe(
        'No price source could price \'SPYD\' in USD: check its tick, exchange and isin, '
        + 'or add its price to the overrides',
      )
      expect((error as AggregateError).errors.map((e: Error) => e.message)).toEqual([
        'justetf quoted \'SPYD\' in EUR, but it is traded in USD',
        'tradingview: not found',
      ])
    })

    it('rejects an override in another currency', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      await expect(repositoryWith([justEtf, tradingView]).getPortfolio('ibkr/eur'))
        .rejects.toThrow('The override for \'SPYD\' is in EUR, but it is traded in USD')
    })

    it('accepts an override in its own currency', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: EUR_OVERRIDES.prices.QDVE,
        SPYD: { price: 69, currency: 'USD' },
      }))

      const spyd = (await repositoryWith([justEtf], [tradingView]).getPortfolio('ibkr/eur'))
        .securities[1]

      expect(spyd.quote.currency).toBe('USD')
      expect(justEtf.getPrice).not.toHaveBeenCalled()
    })
  })

  describe('exchange rates', () => {
    const NOW = new Date('2026-10-06T09:30:00Z')

    /** EUR settings with SPYD listed in USD, paying 0.03% to exchange. */
    function givenUsdSpyd(rateOverrides: Record<string, { rate: number, asOf?: string }> = {}) {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS, currency: 'EUR', fxFeePercentage: 0.0003,
      })
      overrides.getPortfolioOverrides.mockResolvedValue({
        prices: { QDVE: EUR_OVERRIDES.prices.QDVE, SPYD: { price: 69, currency: 'USD' } },
        rates: rateOverrides,
      })
    }

    const clockedRepository = (rates: IExchangeRateDataDriver[] = [tradingView]) => (
      new PortfolioRepository({
        settings, overrides, prices: [justEtf, tradingView], rates,
      }, () => NOW)
    )

    it('converts a security listed in another currency at a live rate, stamped like a price', async () => {
      givenUsdSpyd()
      tradingView.getRate.mockResolvedValue(0.9)

      const portfolio = await clockedRepository().getPortfolio('ibkr/eur')

      expect(tradingView.getRate.mock.calls).toEqual([['USD', 'EUR']])
      const [qdve, spyd] = portfolio.securities
      expect(qdve.exchangeRate).toBeUndefined()
      expect(spyd.exchangeRate?.toValues()).toEqual({
        from: 'USD', to: 'EUR', rate: 0.9, source: 'tradingview', quotedAt: '2026-10-06T09:30:00.000Z',
      })
      expect(spyd.price.toNumber()).toBe(62.1)
      expect(spyd.quote.price.toNumber()).toBe(69)
      expect(portfolio.currency).toBe('EUR')
      expect(portfolio.totalPrice.toNumber()).toBe(9055)
    })

    it('gives every security the FX fee part it sets, or the portfolio\'s', async () => {
      givenUsdSpyd()
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        currency: 'EUR',
        fxFeePercentage: 0.0003,
        securities: [QDVE_SETTING, { ...SPYD_SETTING, fxFeePercentage: 0.002 }],
      })
      tradingView.getRate.mockResolvedValue(0.9)

      const [qdve, spyd] = (await clockedRepository().getPortfolio('ibkr/eur')).securities

      expect(qdve.fxFeePercentage.toNumber()).toBe(0.0003)
      expect(spyd.fxFeePercentage.toNumber()).toBe(0.002)
    })

    it('uses an overridden rate, dated by its asOf, without launching any browser', async () => {
      givenUsdSpyd({ 'USD/EUR': { rate: 0.92, asOf: '2026-10-01' } })

      const portfolio = await clockedRepository().getPortfolio('ibkr/eur')

      expect(portfolio.securities[1].exchangeRate?.toValues()).toEqual({
        from: 'USD', to: 'EUR', rate: 0.92, source: 'override', quotedAt: '2026-10-01',
      })
      expect(tradingView.getRate).not.toHaveBeenCalled()
      expect(justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(tradingView.launchBrowser).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('rejects an overridden rate into another currency, which would never be used', async () => {
      givenUsdSpyd({ 'USD/EUR': { rate: 0.9 }, 'EUR/USD': { rate: 1.1 }, 'USD/GBP': { rate: 0.75 } })
      // Some price has to be scraped: the check still comes first
      overrides.getPortfolioOverrides.mockResolvedValue({
        prices: { QDVE: EUR_OVERRIDES.prices.QDVE },
        rates: { 'USD/EUR': { rate: 0.9 }, 'EUR/USD': { rate: 1.1 }, 'USD/GBP': { rate: 0.75 } },
      })

      await expect(clockedRepository().getPortfolio('ibkr/eur')).rejects.toThrow(
        'The rate override EUR/USD, USD/GBP doesn\'t convert into the portfolio\'s currency (EUR): '
        + 'rates are keyed <FROM>/EUR',
      )
      expect(justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(justEtf.getPrice).not.toHaveBeenCalled()
      expect(tradingView.getRate).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('rejects an overridden rate when the portfolio sets no currency', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue({
        prices: EUR_OVERRIDES.prices, rates: { 'USD/EUR': { rate: 0.9 } },
      })

      await expect(clockedRepository().getPortfolio('ibkr/eur')).rejects.toThrow(
        'The rate override USD/EUR doesn\'t convert into the portfolio\'s currency (not set): '
        + 'rates are keyed <FROM>/<portfolio currency>',
      )
    })

    it('launches only the rate sources when every price is overridden', async () => {
      givenUsdSpyd()
      tradingView.getRate.mockResolvedValue(0.9)

      await clockedRepository().getPortfolio('ibkr/eur')

      expect(justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(tradingView.launchBrowser).toHaveBeenCalledOnce()
      expect(firstCall(tradingView.launchBrowser)).toBeLessThan(firstCall(tradingView.getRate))
      expectBrowsersClosed()
    })

    it('asks once per currency, however many securities are listed in it', async () => {
      settings.getPortfolioSettings.mockResolvedValue({ ...EUR_SETTINGS, currency: 'EUR' })
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: { price: 31.6, currency: 'USD' },
        SPYD: { price: 69, currency: 'USD' },
      }))
      tradingView.getRate.mockResolvedValue(0.9)

      const portfolio = await clockedRepository().getPortfolio('ibkr/eur')

      expect(tradingView.getRate).toHaveBeenCalledOnce()
      expect(portfolio.securities.map((sec) => sec.currency)).toEqual(['EUR', 'EUR'])
    })

    it('asks for no rate when every security is in the portfolio currency', async () => {
      settings.getPortfolioSettings.mockResolvedValue({ ...EUR_SETTINGS, currency: 'EUR' })
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      await clockedRepository().getPortfolio('ibkr/eur')

      expect(tradingView.getRate).not.toHaveBeenCalled()
      expect(tradingView.launchBrowser).not.toHaveBeenCalled()
    })

    it('takes the first rate source in the list that can convert, however fast the others are', async () => {
      givenUsdSpyd()
      const slow = deferred<number>()
      justEtf.getRate.mockReturnValue(slow.promise)
      tradingView.getRate.mockResolvedValue(0.9)

      const result = clockedRepository([justEtf, tradingView]).getPortfolio('ibkr/eur')
      await new Promise((resolve) => setTimeout(resolve, 10))
      slow.resolve(0.95)

      const spyd = (await result).securities[1]
      expect(spyd.exchangeRate?.rate.toNumber()).toBe(0.95)
      expect(spyd.exchangeRate?.source).toBe('justetf')
    })

    it('reports every source that could not convert', async () => {
      givenUsdSpyd()

      const error = await clockedRepository([justEtf, tradingView])
        .getPortfolio('ibkr/eur').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).message).toBe('No exchange-rate source could convert USD/EUR')
      expect((error as AggregateError).errors.map((e: Error) => e.message))
        .toEqual(['justetf: no rate', 'tradingview: no rate'])
      expectBrowsersClosed()
    })

    it('asks to override a rate when there is no rate source', async () => {
      givenUsdSpyd()

      await expect(clockedRepository([]).getPortfolio('ibkr/eur'))
        .rejects.toThrow('No exchange-rate source for USD/EUR: add "USD/EUR" to the overrides')
    })

    it('closes a source that gives prices and rates once, launching it as both', async () => {
      givenUsdSpyd()
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: EUR_OVERRIDES.prices.QDVE,
      }))
      tradingView.getPrice.mockResolvedValue({ price: 69, currency: 'USD' })
      tradingView.getRate.mockResolvedValue(0.9)

      await clockedRepository().getPortfolio('ibkr/eur')

      expect(tradingView.launchBrowser).toHaveBeenCalledTimes(2)
      expect(tradingView.closeBrowser).toHaveBeenCalledOnce()
      expect(justEtf.closeBrowser).toHaveBeenCalledOnce()
    })
  })

  describe('browser lifecycle', () => {
    it('launches both browsers before fetching prices and closes them afterwards', async () => {
      justEtf.getPrice.mockResolvedValue(EUR(10))

      await repository.getPortfolio('ibkr/eur')

      const lastLaunch = Math.max(
        firstCall(justEtf.launchBrowser),
        firstCall(tradingView.launchBrowser),
      )
      const firstPrice = Math.min(
        firstCall(justEtf.getPrice),
        firstCall(tradingView.getPrice),
      )
      const lastPrice = Math.max(...justEtf.getPrice.mock.invocationCallOrder)
      expect(justEtf.launchBrowser).toHaveBeenCalledOnce()
      expect(tradingView.launchBrowser).toHaveBeenCalledOnce()
      expect(lastLaunch).toBeLessThan(firstPrice)
      expectBrowsersClosed()
      expect(firstCall(justEtf.closeBrowser)).toBeGreaterThan(lastPrice)
    })

    it('launches the browsers after reading the data files', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: EUR_OVERRIDES.prices.QDVE,
      }))
      justEtf.getPrice.mockResolvedValue(EUR(62.1))

      await repository.getPortfolio('ibkr/eur')

      expect(firstCall(justEtf.launchBrowser))
        .toBeGreaterThan(firstCall(overrides.getPortfolioOverrides))
    })

    it('launches the browsers in the order of the prices list', async () => {
      tradingView.getPrice.mockResolvedValue(EUR(10))

      await repositoryWith([tradingView, justEtf]).getPortfolio('ibkr/eur')

      expect(firstCall(tradingView.launchBrowser))
        .toBeLessThan(firstCall(justEtf.launchBrowser))
    })

    it('launches the browsers concurrently, and fetches prices once all are up', async () => {
      const firstLaunch = deferred<void>()
      justEtf.launchBrowser.mockReturnValue(firstLaunch.promise)
      justEtf.getPrice.mockResolvedValue(EUR(10))

      const result = repository.getPortfolio('ibkr/eur')
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(justEtf.launchBrowser).toHaveBeenCalledOnce()
      expect(tradingView.launchBrowser).toHaveBeenCalledOnce()
      expect(justEtf.getPrice).not.toHaveBeenCalled()
      firstLaunch.resolve()
      await result
      expect(justEtf.getPrice).toHaveBeenCalled()
    })

    it('does not launch any browser when every price is overridden (closing is a no-op)', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      await repository.getPortfolio('ibkr/eur')

      expect(justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(tradingView.launchBrowser).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('does not launch any browser for a portfolio without securities', async () => {
      settings.getPortfolioSettings.mockResolvedValue({ ...EUR_SETTINGS, securities: [] })

      await repository.getPortfolio('ibkr/eur').catch(() => undefined)

      expect(justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(tradingView.launchBrowser).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('launches both browsers when a single security is not overridden', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(priceOverrides({
        QDVE: EUR_OVERRIDES.prices.QDVE,
      }))
      tradingView.getPrice.mockResolvedValue(EUR(62.1))

      await repository.getPortfolio('ibkr/eur')

      expect(justEtf.launchBrowser).toHaveBeenCalledOnce()
      expect(tradingView.launchBrowser).toHaveBeenCalledOnce()
      expectBrowsersClosed()
    })

    it('launches the browsers for a tick named like an Object.prototype member', async () => {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        securities: [{ ...QDVE_SETTING, tick: 'constructor', targetPercentage: 1 }],
      })
      justEtf.getPrice.mockResolvedValue(EUR(28.45))

      await repository.getPortfolio('ibkr/eur')

      expect(justEtf.launchBrowser).toHaveBeenCalledOnce()
      expect(tradingView.launchBrowser).toHaveBeenCalledOnce()
    })

    it('closes the browsers when every source fails', async () => {
      await expect(repository.getPortfolio('ibkr/eur')).rejects.toBeInstanceOf(AggregateError)

      expectBrowsersClosed()
    })

    it('closes the browsers when reading the settings fails, without launching them', async () => {
      settings.getPortfolioSettings.mockRejectedValue(Error('Portfolio \'ibkr/x\' not found'))

      await expect(repository.getPortfolio('ibkr/x')).rejects.toThrow('Portfolio \'ibkr/x\' not found')

      expect(justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(tradingView.launchBrowser).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('closes both browsers when launching the second one fails', async () => {
      tradingView.launchBrowser.mockRejectedValue(Error('launch failed'))

      await expect(repository.getPortfolio('ibkr/eur')).rejects.toThrow('launch failed')

      expectBrowsersClosed()
    })

    it('fetches no price and closes every browser when launching the first one fails', async () => {
      justEtf.launchBrowser.mockRejectedValue(Error('launch failed'))

      await expect(repository.getPortfolio('ibkr/eur')).rejects.toThrow('launch failed')

      expect(tradingView.launchBrowser).toHaveBeenCalledOnce()
      expect(justEtf.getPrice).not.toHaveBeenCalled()
      expect(tradingView.getPrice).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('waits for the browsers to close before resolving', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      const close = deferred<void>()
      justEtf.closeBrowser.mockReturnValue(close.promise)
      let settled = false

      const result = repository.getPortfolio('ibkr/eur').then((portfolio) => {
        settled = true
        return portfolio
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(settled).toBe(false)
      close.resolve()
      expect(await result).toBeInstanceOf(Portfolio)
    })

    it('reports a failure to close the browsers', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      justEtf.closeBrowser.mockRejectedValue(Error('close failed'))

      await expect(repository.getPortfolio('ibkr/eur')).rejects.toThrow('close failed')
    })

    it('still closes every other browser when one fails to close', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      justEtf.closeBrowser.mockRejectedValue(Error('close failed'))

      await repository.getPortfolio('ibkr/eur').catch(() => undefined)

      expectBrowsersClosed()
    })

    it('reports the error that ended the load, not a failure to close afterwards', async () => {
      settings.getPortfolioSettings.mockRejectedValue(Error('Portfolio \'ibkr/x\' not found'))
      justEtf.closeBrowser.mockRejectedValue(Error('close failed'))

      await expect(repository.getPortfolio('ibkr/x')).rejects.toThrow('Portfolio \'ibkr/x\' not found')
      expectBrowsersClosed()
    })

    it('waits for every browser to close before reporting a load error', async () => {
      settings.getPortfolioSettings.mockRejectedValue(Error('Portfolio \'ibkr/x\' not found'))
      const close = deferred<void>()
      tradingView.closeBrowser.mockReturnValue(close.promise)
      let settled = false

      const result = repository.getPortfolio('ibkr/x').catch((e: unknown) => {
        settled = true
        return e
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(settled).toBe(false)
      close.resolve()
      expect(await result).toEqual(Error('Portfolio \'ibkr/x\' not found'))
    })
  })
})
