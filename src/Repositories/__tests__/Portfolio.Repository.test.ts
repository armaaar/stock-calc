import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import type {
  IOverridesDataDriver, IPriceDataDriver, ISettingsDataDriver, SecurityPriceDto,
} from '#src/DataDrivers/DataDrivers.type'
import {
  EUR_OVERRIDES, EUR_SETTINGS, QDVE_SETTING, SPYD_SETTING, withoutIsin,
} from '#src/__fixtures__/dataFiles'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'
import { PortfolioRepository } from '../Portfolio.Repository'

/** Reads `EUR_SETTINGS` for every portfolio type. */
function fakeSettingsDataDriver() {
  return {
    getPortfolioSettings: vi.fn<ISettingsDataDriver['getPortfolioSettings']>()
      .mockResolvedValue(EUR_SETTINGS),
  } satisfies ISettingsDataDriver
}

/** No overrides for any portfolio type. */
function fakeOverridesDataDriver() {
  return {
    getPortfolioOverrides: vi.fn<IOverridesDataDriver['getPortfolioOverrides']>()
      .mockResolvedValue({}),
  } satisfies IOverridesDataDriver
}

/** A price source that can't price anything; its browser launches and closes fine. */
function fakePriceDataDriver(name: string) {
  return {
    name,
    getPrice: vi.fn<IPriceDataDriver['getPrice']>()
      .mockRejectedValue(Error(`${name}: not found`)),
    launchBrowser: vi.fn<IPriceDataDriver['launchBrowser']>().mockResolvedValue(undefined),
    closeBrowser: vi.fn<IPriceDataDriver['closeBrowser']>().mockResolvedValue(undefined),
  } satisfies IPriceDataDriver
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

  /** A repository over the shared settings / overrides fakes and the given price drivers. */
  const repositoryWith = (prices: IPriceDataDriver[]) => (
    new PortfolioRepository({ settings, overrides, prices })
  )

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
    it('reads settings and overrides for the requested portfolio type', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      await repository.getPortfolio('EGP')

      expect(settings.getPortfolioSettings).toHaveBeenCalledWith('EGP')
      expect(overrides.getPortfolioOverrides).toHaveBeenCalledWith('EGP')
    })

    it('reads them again on every load (nothing is cached)', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const first = await repository.getPortfolio('EUR')
      const second = await repository.getPortfolio('EGP')

      expect(first).not.toBe(second)
      expect(settings.getPortfolioSettings.mock.calls).toEqual([['EUR'], ['EGP']])
      expect(overrides.getPortfolioOverrides.mock.calls).toEqual([['EUR'], ['EGP']])
    })
  })

  describe('price resolution', () => {
    it('uses overrides and never calls the scrapers for overridden ticks', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repository.getPortfolio('EUR')

      expect(justEtf.getPrice).not.toHaveBeenCalled()
      expect(tradingView.getPrice).not.toHaveBeenCalled()
      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
    })

    it('scrapes only the ticks that are not overridden', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue({ QDVE: EUR_OVERRIDES.QDVE })
      tradingView.getPrice.mockResolvedValue(EUR(62.1))

      const portfolio = await repository.getPortfolio('EUR')

      expect(justEtf.getPrice.mock.calls).toEqual([[SPYD_SETTING]])
      expect(tradingView.getPrice.mock.calls).toEqual([[SPYD_SETTING]])
      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
    })

    it('an override wins even when a scraper could price the security', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue({ QDVE: EUR(1), SPYD: EUR(2) })
      justEtf.getPrice.mockResolvedValue(EUR(999))

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([1, 2])
    })

    it('asks every source with the full setting, but prefers the first in the list', async () => {
      // tradingview answers first, but justetf comes first in the list and can price both
      const justEtfPrice = deferred<SecurityPriceDto>()
      justEtf.getPrice.mockReturnValue(justEtfPrice.promise)
      tradingView.getPrice.mockResolvedValue(EUR(30))

      const result = repository.getPortfolio('EUR')
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

      const result = repository.getPortfolio('EUR')
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

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
      expect(portfolio.securities.map((s) => s.quote.source)).toEqual(['justetf', 'tradingview'])
    })

    it('time-stamps live prices with the injected clock', async () => {
      const now = new Date('2026-10-06T09:30:00Z')
      justEtf.getPrice.mockResolvedValue(EUR(10))

      const portfolio = await new PortfolioRepository(
        { settings, overrides, prices: [justEtf] },
        () => now,
      ).getPortfolio('EUR')

      expect(portfolio.securities.map((s) => s.quote.quotedAt)).toEqual([now, now])
    })

    it('time-stamps live prices with the current time by default', async () => {
      justEtf.getPrice.mockResolvedValue(EUR(10))
      const before = Date.now()

      const portfolio = await repository.getPortfolio('EUR')

      const quotedAt = portfolio.securities[0].quote.quotedAt as Date
      expect(quotedAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(quotedAt.getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('marks overridden prices as overrides, dated by their optional asOf', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue({
        QDVE: { ...EUR_OVERRIDES.QDVE, asOf: '2026-10-01' },
        SPYD: EUR_OVERRIDES.SPYD,
      })

      const [qdve, spyd] = (await repository.getPortfolio('EUR')).securities

      expect(qdve.quote.source).toBe('override')
      expect(qdve.quote.quotedAt).toEqual(new Date('2026-10-01'))
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

      const error = await repository.getPortfolio('EUR').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).message).toBe('No price source could price \'QDVE\'')
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

      const error = await repositoryWith([tradingView, justEtf]).getPortfolio('EUR')
        .catch((e: unknown) => e)

      expect((error as AggregateError).errors).toEqual([tradingViewError, justEtfError])
    })

    it('one unpriceable security fails the whole portfolio', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue({ QDVE: EUR_OVERRIDES.QDVE })

      await expect(repository.getPortfolio('EUR')).rejects.toBeInstanceOf(AggregateError)
    })

    it('scrapes a tick named like an Object.prototype member instead of overriding it', async () => {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        securities: [{ ...QDVE_SETTING, tick: 'toString', targetPercentage: 1 }],
      })
      justEtf.getPrice.mockResolvedValue(EUR(28.45))

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.securities[0].price.toNumber()).toBe(28.45)
      expect(justEtf.getPrice).toHaveBeenCalledOnce()
    })
  })

  describe('injected price data drivers', () => {
    it('prices every security from a single price driver', async () => {
      justEtf.getPrice.mockImplementation(async ({ tick }) => (
        tick === 'QDVE' ? EUR(28.45) : EUR(62.1)
      ))

      const portfolio = await repositoryWith([justEtf]).getPortfolio('EUR')

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

      const error = await repositoryWith([justEtf]).getPortfolio('EUR').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors).toEqual([justEtfError])
      expect(justEtf.closeBrowser).toHaveBeenCalledOnce()
    })

    it('works without any price driver when every price is overridden', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repositoryWith([]).getPortfolio('EUR')

      expect(portfolio.totalPrice.toNumber()).toBe(9055)
    })

    it('names the un-overridden security when there is no price driver', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue({ QDVE: EUR_OVERRIDES.QDVE })

      await expect(repositoryWith([]).getPortfolio('EUR'))
        .rejects.toThrow('No price source for \'SPYD\': add its price to the overrides')
    })

    it('asks a third price driver alongside the others', async () => {
      const third = fakePriceDataDriver('third')
      third.getPrice.mockResolvedValue(EUR(50))

      const portfolio = await repositoryWith([justEtf, tradingView, third]).getPortfolio('EUR')

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

      const portfolio = await repository.getPortfolio('EUR')

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
        expect(security.price.toNumber()).toBe(EUR_OVERRIDES[setting.tick].price)
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

      const portfolio = await repository.getPortfolio('EUR')

      portfolio.securities.forEach((security) => {
        expect(security.brokerageFeeFlat.toNumber()).toBe(2.5)
        expect(security.tradingFeePercentage.toNumber()).toBe(0.001)
        expect(security.minimumTradingFeeFlat.toNumber()).toBe(3)
      })
    })

    it('passes the cash held to the portfolio, or none when the settings have none', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      expect((await repository.getPortfolio('EUR')).cash.toNumber()).toBe(0)

      settings.getPortfolioSettings.mockResolvedValue({ ...EUR_SETTINGS, cash: 321.5 })
      expect((await repository.getPortfolio('EUR')).cash.toNumber()).toBe(321.5)
    })

    it('passes the fee warning percentage, or leaves the default', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      expect((await repository.getPortfolio('EUR')).feeWarningPercentage.toNumber()).toBe(0.01)

      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS, feeWarningPercentage: 0.02,
      })
      expect((await repository.getPortfolio('EUR')).feeWarningPercentage.toNumber()).toBe(0.02)
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

      const [qdve, spyd] = (await repository.getPortfolio('EUR')).securities

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

      const [qdve, spyd] = (await repository.getPortfolio('EUR')).securities

      expect(qdve[part].toNumber()).toBe(0)
      expect(spyd[part].toNumber()).toBe(portfolioFee)
    })

    it('keeps an undefined isin for securities without one', async () => {
      settings.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        securities: [withoutIsin(QDVE_SETTING), SPYD_SETTING],
      })
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.securities[0].isin).toBeUndefined()
    })

    it('takes the currency from the price quote', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue({
        QDVE: { price: 28.45, currency: 'USD' },
        SPYD: { price: 62.1, currency: 'USD' },
      })

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.currency).toBe('USD')
    })

    it('propagates Portfolio invariant errors (mixed currencies)', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue({
        QDVE: { price: 28.45, currency: 'EUR' },
        SPYD: { price: 62.1, currency: 'USD' },
      })

      await expect(repository.getPortfolio('EUR'))
        .rejects.toThrow('Portfolio have securities with different currencies')
      expectBrowsersClosed()
    })
  })

  describe('browser lifecycle', () => {
    it('launches both browsers before fetching prices and closes them afterwards', async () => {
      justEtf.getPrice.mockResolvedValue(EUR(10))

      await repository.getPortfolio('EUR')

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
      overrides.getPortfolioOverrides.mockResolvedValue({ QDVE: EUR_OVERRIDES.QDVE })
      justEtf.getPrice.mockResolvedValue(EUR(62.1))

      await repository.getPortfolio('EUR')

      expect(firstCall(justEtf.launchBrowser))
        .toBeGreaterThan(firstCall(overrides.getPortfolioOverrides))
    })

    it('launches the browsers in the order of the prices list', async () => {
      tradingView.getPrice.mockResolvedValue(EUR(10))

      await repositoryWith([tradingView, justEtf]).getPortfolio('EUR')

      expect(firstCall(tradingView.launchBrowser))
        .toBeLessThan(firstCall(justEtf.launchBrowser))
    })

    it('launches the browsers concurrently, and fetches prices once all are up', async () => {
      const firstLaunch = deferred<void>()
      justEtf.launchBrowser.mockReturnValue(firstLaunch.promise)
      justEtf.getPrice.mockResolvedValue(EUR(10))

      const result = repository.getPortfolio('EUR')
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

      await repository.getPortfolio('EUR')

      expect(justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(tradingView.launchBrowser).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('does not launch any browser for a portfolio without securities', async () => {
      settings.getPortfolioSettings.mockResolvedValue({ ...EUR_SETTINGS, securities: [] })

      await repository.getPortfolio('EUR').catch(() => undefined)

      expect(justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(tradingView.launchBrowser).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('launches both browsers when a single security is not overridden', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue({ QDVE: EUR_OVERRIDES.QDVE })
      tradingView.getPrice.mockResolvedValue(EUR(62.1))

      await repository.getPortfolio('EUR')

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

      await repository.getPortfolio('EUR')

      expect(justEtf.launchBrowser).toHaveBeenCalledOnce()
      expect(tradingView.launchBrowser).toHaveBeenCalledOnce()
    })

    it('closes the browsers when every source fails', async () => {
      await expect(repository.getPortfolio('EUR')).rejects.toBeInstanceOf(AggregateError)

      expectBrowsersClosed()
    })

    it('closes the browsers when reading the settings fails, without launching them', async () => {
      settings.getPortfolioSettings.mockRejectedValue(Error('Portfolio \'X\' not found'))

      await expect(repository.getPortfolio('X')).rejects.toThrow('Portfolio \'X\' not found')

      expect(justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(tradingView.launchBrowser).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('closes both browsers when launching the second one fails', async () => {
      tradingView.launchBrowser.mockRejectedValue(Error('launch failed'))

      await expect(repository.getPortfolio('EUR')).rejects.toThrow('launch failed')

      expectBrowsersClosed()
    })

    it('fetches no price and closes every browser when launching the first one fails', async () => {
      justEtf.launchBrowser.mockRejectedValue(Error('launch failed'))

      await expect(repository.getPortfolio('EUR')).rejects.toThrow('launch failed')

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

      const result = repository.getPortfolio('EUR').then((portfolio) => {
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

      await expect(repository.getPortfolio('EUR')).rejects.toThrow('close failed')
    })

    it('still closes every other browser when one fails to close', async () => {
      overrides.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      justEtf.closeBrowser.mockRejectedValue(Error('close failed'))

      await repository.getPortfolio('EUR').catch(() => undefined)

      expectBrowsersClosed()
    })

    it('reports the error that ended the load, not a failure to close afterwards', async () => {
      settings.getPortfolioSettings.mockRejectedValue(Error('Portfolio \'X\' not found'))
      justEtf.closeBrowser.mockRejectedValue(Error('close failed'))

      await expect(repository.getPortfolio('X')).rejects.toThrow('Portfolio \'X\' not found')
      expectBrowsersClosed()
    })

    it('waits for every browser to close before reporting a load error', async () => {
      settings.getPortfolioSettings.mockRejectedValue(Error('Portfolio \'X\' not found'))
      const close = deferred<void>()
      tradingView.closeBrowser.mockReturnValue(close.promise)
      let settled = false

      const result = repository.getPortfolio('X').catch((e: unknown) => {
        settled = true
        return e
      })
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(settled).toBe(false)
      close.resolve()
      expect(await result).toEqual(Error('Portfolio \'X\' not found'))
    })
  })
})
