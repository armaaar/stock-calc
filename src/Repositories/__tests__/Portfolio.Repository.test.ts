import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import type {
  SecurityPriceDto, SettingsDto, SettingsSecurityDto,
} from '@/DataDrivers/IPriceDataDriver.type'
import {
  EUR_OVERRIDES, EUR_SETTINGS, QDVE_SETTING, SPYD_SETTING, withoutIsin,
} from '@/__fixtures__/dataFiles'
import { Portfolio } from '@/Entities/Portfolio.Entity'
import { PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity'
import { PortfolioRepository } from '.././Portfolio.Repository'

type GetPrice = (setting: SettingsSecurityDto) => Promise<SecurityPriceDto>

const dd = vi.hoisted(() => ({
  getPortfolioSettings: vi.fn<(type: string) => Promise<SettingsDto>>(),
  getPortfolioOverrides: vi.fn<(type: string) => Promise<Record<string, SecurityPriceDto>>>(),
  justEtf: {
    getPrice: vi.fn<GetPrice>(),
    launchBrowser: vi.fn<() => Promise<void>>(),
    closeBrowser: vi.fn<() => Promise<void>>(),
  },
  tradingView: {
    getPrice: vi.fn<GetPrice>(),
    launchBrowser: vi.fn<() => Promise<void>>(),
    closeBrowser: vi.fn<() => Promise<void>>(),
  },
}))

vi.mock('@/DataDrivers/Settings.DataDriver', () => ({
  SettingsDataDriver: class {
    getPortfolioSettings = dd.getPortfolioSettings
  },
}))

vi.mock('@/DataDrivers/Overrides.DataDriver', () => ({
  OverridesDataDriver: class {
    getPortfolioOverrides = dd.getPortfolioOverrides
  },
}))

vi.mock('@/DataDrivers/JustEtf.DataDriver', () => ({
  JustEtfDataDriver: class {
    getPrice = dd.justEtf.getPrice

    launchBrowser = dd.justEtf.launchBrowser

    closeBrowser = dd.justEtf.closeBrowser
  },
}))

vi.mock('@/DataDrivers/TradingView.DataDriver', () => ({
  TradingViewDataDriver: class {
    getPrice = dd.tradingView.getPrice

    launchBrowser = dd.tradingView.launchBrowser

    closeBrowser = dd.tradingView.closeBrowser
  },
}))

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

const browserMocks = () => [
  dd.justEtf.launchBrowser, dd.tradingView.launchBrowser,
  dd.justEtf.closeBrowser, dd.tradingView.closeBrowser,
]

const firstCall = (fn: { mock: { invocationCallOrder: number[] } }) => (
  fn.mock.invocationCallOrder[0]
)

function expectBrowsersClosed() {
  expect(dd.justEtf.closeBrowser).toHaveBeenCalledOnce()
  expect(dd.tradingView.closeBrowser).toHaveBeenCalledOnce()
}

describe('PortfolioRepository', () => {
  let repository: PortfolioRepository

  beforeEach(() => {
    vi.resetAllMocks()
    dd.getPortfolioSettings.mockResolvedValue(EUR_SETTINGS)
    dd.getPortfolioOverrides.mockResolvedValue({})
    browserMocks().forEach((fn) => fn.mockResolvedValue(undefined))
    dd.justEtf.getPrice.mockRejectedValue(Error('justetf: not found'))
    dd.tradingView.getPrice.mockRejectedValue(Error('tradingview: not found'))
    repository = new PortfolioRepository()
  })

  describe('data files', () => {
    it('reads settings and overrides for the requested portfolio type', async () => {
      dd.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      await repository.getPortfolio('EGP')

      expect(dd.getPortfolioSettings).toHaveBeenCalledWith('EGP')
      expect(dd.getPortfolioOverrides).toHaveBeenCalledWith('EGP')
    })
  })

  describe('price resolution', () => {
    it('uses overrides and never calls the scrapers for overridden ticks', async () => {
      dd.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repository.getPortfolio('EUR')

      expect(dd.justEtf.getPrice).not.toHaveBeenCalled()
      expect(dd.tradingView.getPrice).not.toHaveBeenCalled()
      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
    })

    it('scrapes only the ticks that are not overridden', async () => {
      dd.getPortfolioOverrides.mockResolvedValue({ QDVE: EUR_OVERRIDES.QDVE })
      dd.tradingView.getPrice.mockResolvedValue(EUR(62.1))

      const portfolio = await repository.getPortfolio('EUR')

      expect(dd.justEtf.getPrice.mock.calls).toEqual([[SPYD_SETTING]])
      expect(dd.tradingView.getPrice.mock.calls).toEqual([[SPYD_SETTING]])
      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
    })

    it('an override wins even when a scraper could price the security', async () => {
      dd.getPortfolioOverrides.mockResolvedValue({ QDVE: EUR(1), SPYD: EUR(2) })
      dd.justEtf.getPrice.mockResolvedValue(EUR(999))

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([1, 2])
    })

    it('races both scrapers with the full setting and takes the first success', async () => {
      const justEtf = deferred<SecurityPriceDto>()
      dd.justEtf.getPrice.mockReturnValue(justEtf.promise)
      dd.tradingView.getPrice.mockResolvedValue(EUR(30))

      const portfolio = await repository.getPortfolio('EUR')
      justEtf.resolve(EUR(10))

      expect(dd.justEtf.getPrice.mock.calls).toEqual([[QDVE_SETTING], [SPYD_SETTING]])
      expect(dd.tradingView.getPrice.mock.calls).toEqual([[QDVE_SETTING], [SPYD_SETTING]])
      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([30, 30])
    })

    it('takes the first success even if the faster source failed', async () => {
      const tradingView = deferred<SecurityPriceDto>()
      dd.justEtf.getPrice.mockRejectedValue(Error('justetf: not found'))
      dd.tradingView.getPrice.mockReturnValue(tradingView.promise)

      const result = repository.getPortfolio('EUR')
      setTimeout(() => tradingView.resolve(EUR(40)), 0)
      const portfolio = await result

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([40, 40])
    })

    it('uses the first-resolving source per security', async () => {
      dd.justEtf.getPrice.mockImplementation(async ({ tick }) => {
        if (tick === 'QDVE') return EUR(28.45)
        return new Promise(() => undefined) // never settles
      })
      dd.tradingView.getPrice.mockImplementation(async ({ tick }) => {
        if (tick === 'SPYD') return EUR(62.1)
        throw Error('tradingview: not found')
      })

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.securities.map((s) => s.price.toNumber())).toEqual([28.45, 62.1])
    })

    it('rejects with an AggregateError of every source error when all sources fail', async () => {
      const justEtfError = Error('justetf: not found')
      const tradingViewError = Error('tradingview: not found')
      dd.getPortfolioSettings.mockResolvedValue({ ...EUR_SETTINGS, securities: [QDVE_SETTING] })
      dd.justEtf.getPrice.mockRejectedValue(justEtfError)
      dd.tradingView.getPrice.mockRejectedValue(tradingViewError)

      const error = await repository.getPortfolio('EUR').catch((e: unknown) => e)

      expect(error).toBeInstanceOf(AggregateError)
      expect((error as AggregateError).errors).toEqual([justEtfError, tradingViewError])
    })

    it('one unpriceable security fails the whole portfolio', async () => {
      dd.getPortfolioOverrides.mockResolvedValue({ QDVE: EUR_OVERRIDES.QDVE })

      await expect(repository.getPortfolio('EUR')).rejects.toBeInstanceOf(AggregateError)
    })

    it('scrapes a tick named like an Object.prototype member instead of overriding it', async () => {
      dd.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        securities: [{ ...QDVE_SETTING, tick: 'toString', targetPercentage: 1 }],
      })
      dd.justEtf.getPrice.mockResolvedValue(EUR(28.45))

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.securities[0].price.toNumber()).toBe(28.45)
      expect(dd.justEtf.getPrice).toHaveBeenCalledOnce()
    })
  })

  describe('building the Portfolio', () => {
    it('returns a Portfolio with the settings and prices of every security', async () => {
      dd.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

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

    it('copies the fee settings to every PortfolioSecurity', async () => {
      dd.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        brokerageFeeFlat: 2.5,
        tradingFeePercentage: 0.001,
        minimumTradingFeeFlat: 3,
      })
      dd.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repository.getPortfolio('EUR')

      portfolio.securities.forEach((security) => {
        expect(security.brokerageFeeFlat.toNumber()).toBe(2.5)
        expect(security.tradingFeePercentage.toNumber()).toBe(0.001)
        expect(security.minimumTradingFeeFlat.toNumber()).toBe(3)
      })
    })

    it('keeps an undefined isin for securities without one', async () => {
      dd.getPortfolioSettings.mockResolvedValue({
        ...EUR_SETTINGS,
        securities: [withoutIsin(QDVE_SETTING), SPYD_SETTING],
      })
      dd.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.securities[0].isin).toBeUndefined()
    })

    it('takes the currency from the price quote', async () => {
      dd.getPortfolioOverrides.mockResolvedValue({
        QDVE: { price: 28.45, currency: 'USD' },
        SPYD: { price: 62.1, currency: 'USD' },
      })

      const portfolio = await repository.getPortfolio('EUR')

      expect(portfolio.currency).toBe('USD')
    })

    it('propagates Portfolio invariant errors (mixed currencies)', async () => {
      dd.getPortfolioOverrides.mockResolvedValue({
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
      dd.justEtf.getPrice.mockResolvedValue(EUR(10))

      await repository.getPortfolio('EUR')

      const lastLaunch = Math.max(
        firstCall(dd.justEtf.launchBrowser),
        firstCall(dd.tradingView.launchBrowser),
      )
      const firstPrice = Math.min(
        firstCall(dd.justEtf.getPrice),
        firstCall(dd.tradingView.getPrice),
      )
      const lastPrice = Math.max(...dd.justEtf.getPrice.mock.invocationCallOrder)
      expect(dd.justEtf.launchBrowser).toHaveBeenCalledOnce()
      expect(dd.tradingView.launchBrowser).toHaveBeenCalledOnce()
      expect(lastLaunch).toBeLessThan(firstPrice)
      expectBrowsersClosed()
      expect(firstCall(dd.justEtf.closeBrowser)).toBeGreaterThan(lastPrice)
    })

    it('launches the browsers after reading the data files', async () => {
      dd.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      await repository.getPortfolio('EUR')

      expect(firstCall(dd.justEtf.launchBrowser))
        .toBeGreaterThan(firstCall(dd.getPortfolioOverrides))
    })

    // Current behaviour: browsers are launched even when every price comes from overrides.
    it('launches and closes the browsers even when every price is overridden', async () => {
      dd.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)

      await repository.getPortfolio('EUR')

      expect(dd.justEtf.launchBrowser).toHaveBeenCalledOnce()
      expect(dd.tradingView.launchBrowser).toHaveBeenCalledOnce()
      expectBrowsersClosed()
    })

    it('closes the browsers when every source fails', async () => {
      await expect(repository.getPortfolio('EUR')).rejects.toBeInstanceOf(AggregateError)

      expectBrowsersClosed()
    })

    it('closes the browsers when reading the settings fails, without launching them', async () => {
      dd.getPortfolioSettings.mockRejectedValue(Error('Portfolio \'X\' not found'))

      await expect(repository.getPortfolio('X')).rejects.toThrow('Portfolio \'X\' not found')

      expect(dd.justEtf.launchBrowser).not.toHaveBeenCalled()
      expect(dd.tradingView.launchBrowser).not.toHaveBeenCalled()
      expectBrowsersClosed()
    })

    it('closes both browsers when launching the second one fails', async () => {
      dd.tradingView.launchBrowser.mockRejectedValue(Error('launch failed'))

      await expect(repository.getPortfolio('EUR')).rejects.toThrow('launch failed')

      expectBrowsersClosed()
    })

    it('waits for the browsers to close before resolving', async () => {
      dd.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      const close = deferred<void>()
      dd.justEtf.closeBrowser.mockReturnValue(close.promise)
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
      dd.getPortfolioOverrides.mockResolvedValue(EUR_OVERRIDES)
      dd.justEtf.closeBrowser.mockRejectedValue(Error('close failed'))

      await expect(repository.getPortfolio('EUR')).rejects.toThrow('close failed')
    })
  })
})
