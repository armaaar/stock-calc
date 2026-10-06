import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { QDVE_SETTING, withoutIsin } from '#src/__fixtures__/dataFiles'
import {
  createFakeBrowser, createFakePage, FakeBrowser, fakeLauncher, FakeSelectorResult,
} from '#src/__fixtures__/puppeteer'
import { symbolOfUrl, TradingViewDataDriver } from '../TradingView.DataDriver'

const PRICE_SELECTOR = '[data-symbol="IBIS2:QDVE"] .js-symbol-last'
const CURRENCY_SELECTOR = '[data-symbol="IBIS2:QDVE"] .js-symbol-currency'

const NOT_REGISTERED = 'Tick \'QDVE\' at \'IBIS2\' is not registered in tradingview.com'

describe('TradingViewDataDriver', () => {
  let driver: TradingViewDataDriver
  let browser: FakeBrowser
  let launch: ReturnType<typeof fakeLauncher>

  async function launchWith(price: FakeSelectorResult, currency: FakeSelectorResult) {
    browser = createFakeBrowser(createFakePage({
      [PRICE_SELECTOR]: price,
      [CURRENCY_SELECTOR]: currency,
    }))
    launch = fakeLauncher(browser)
    driver = new TradingViewDataDriver(launch)
    await driver.launchBrowser()
  }

  beforeEach(() => {
    launch = fakeLauncher()
    driver = new TradingViewDataDriver(launch)
  })

  it('names itself tradingview.com, for the quotes it gives', () => {
    expect(new TradingViewDataDriver(fakeLauncher()).name).toBe('tradingview.com')
  })

  it('throws when the browser was not launched', async () => {
    await expect(driver.getPrice(QDVE_SETTING)).rejects.toThrow(/launch the browser first/)
  })

  it('loads the symbol page with a 30s timeout and reads the visible price and currency', async () => {
    await launchWith({ text: '28.45' }, { text: 'EUR' })

    await expect(driver.getPrice(QDVE_SETTING)).resolves.toEqual({ price: 28.45, currency: 'EUR' })

    const { page } = browser
    expect(launch).toHaveBeenCalledOnce()
    expect(browser.newPage).toHaveBeenCalledOnce()
    expect(page.goto).toHaveBeenCalledWith('https://www.tradingview.com/symbols/IBIS2-QDVE/')
    expect(page.setDefaultTimeout).toHaveBeenCalledWith(30000)
    expect(page.setDefaultTimeout.mock.invocationCallOrder[0])
      .toBeLessThan(page.goto.mock.invocationCallOrder[0])
    expect(page.waitForSelector.mock.calls).toEqual([
      [PRICE_SELECTOR, { visible: true }],
      [CURRENCY_SELECTOR, { visible: true }],
    ])
  })

  // A background tab is hidden, and `{ visible: true }` polls with requestAnimationFrame, which a
  // hidden page never runs: the quote would only be seen if it was there at the first check
  it('opens each page in a window of its own, so the visible-quote wait can poll', async () => {
    await launchWith({ text: '28.45' }, { text: 'EUR' })

    await driver.getPrice(QDVE_SETTING)
    await driver.getPrice(QDVE_SETTING)

    expect(browser.newPage.mock.calls).toEqual([[{ type: 'window' }], [{ type: 'window' }]])
  })

  it('does not need an ISIN', async () => {
    await launchWith({ text: '28.45' }, { text: 'EUR' })
    const noIsin = withoutIsin(QDVE_SETTING)

    await expect(driver.getPrice(noIsin)).resolves.toEqual({ price: 28.45, currency: 'EUR' })
  })

  it.each([
    ['price', Error('price timeout'), { text: 'EUR' }],
    ['currency', { text: '28.45' }, Error('currency timeout')],
  ] as const)(
    'wraps a %s selector failure in a "not registered" error with the cause set',
    async (_which, price, currency) => {
      await launchWith(price, currency)

      const error = await driver.getPrice(QDVE_SETTING).catch((e: Error) => e)

      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe(NOT_REGISTERED)
      expect((error as Error).cause).toBeInstanceOf(Error)
      expect(((error as Error).cause as Error).message).toMatch(/timeout/)
    },
  )

  it('wraps a navigation failure in a "not registered" error with the cause set', async () => {
    await launchWith({ text: '28.45' }, { text: 'EUR' })
    const navigation = Error('net::ERR_NAME_NOT_RESOLVED')
    browser.page.goto.mockRejectedValueOnce(navigation)

    const error = await driver.getPrice(QDVE_SETTING).catch((e: Error) => e)

    expect((error as Error).message).toBe(NOT_REGISTERED)
    expect((error as Error).cause).toBe(navigation)
    expect(browser.page.waitForSelector).not.toHaveBeenCalled()
  })

  it.each([
    ['no elements', null, null, 'No price text found'],
    ['elements without text', { text: null }, { text: null }, 'No price text found'],
    ['a zero price', { text: '0' }, { text: 'EUR' }, 'Price \'0\' is not a positive number'],
    ['a missing currency element', { text: '28.45' }, null, 'No currency text found'],
    ['an empty currency', { text: '28.45' }, { text: ' \u00a0' }, 'No currency text found'],
  ] as const)('rejects %s with a "not registered" error caused by the parser', async (
    _case,
    price,
    currency,
    cause,
  ) => {
    await launchWith(price, currency)

    const error = await driver.getPrice(QDVE_SETTING).catch((e: Error) => e)

    expect((error as Error).message).toBe(NOT_REGISTERED)
    expect(((error as Error).cause as Error).message).toBe(cause)
  })

  it('parses a price with thousands separators and trims the currency', async () => {
    await launchWith({ text: '1,234.56\u202f' }, { text: ' USD\n' })

    await expect(driver.getPrice(QDVE_SETTING))
      .resolves.toEqual({ price: 1234.56, currency: 'USD' })
  })

  // By design (ADR-0006): pages are never closed; they're cleaned up when the browser closes.
  it('does not close the page it opened', async () => {
    await launchWith({ text: '28.45' }, { text: 'EUR' })

    await driver.getPrice(QDVE_SETTING)

    expect(browser.page.close).not.toHaveBeenCalled()
    expect(browser.close).not.toHaveBeenCalled()
  })

  describe('getRate', () => {
    const RATE_PRICE = '[data-symbol="FX_IDC:USDEUR"] .js-symbol-last'
    const RATE_CURRENCY = '[data-symbol="FX_IDC:USDEUR"] .js-symbol-currency'

    async function launchWithRate(rate: FakeSelectorResult, currency: FakeSelectorResult) {
      browser = createFakeBrowser(createFakePage({ [RATE_PRICE]: rate, [RATE_CURRENCY]: currency }))
      driver = new TradingViewDataDriver(fakeLauncher(browser))
      await driver.launchBrowser()
    }

    it('reads what one unit of a currency is worth in another from the FX_IDC pair page', async () => {
      await launchWithRate({ text: '0.8877' }, { text: 'EUR' })

      await expect(driver.getRate('USD', 'EUR')).resolves.toBe(0.8877)

      const { page } = browser
      expect(browser.newPage).toHaveBeenCalledWith({ type: 'window' })
      expect(page.goto).toHaveBeenCalledWith('https://www.tradingview.com/symbols/FX_IDC-USDEUR/')
      expect(page.setDefaultTimeout).toHaveBeenCalledWith(30000)
      expect(page.waitForSelector.mock.calls).toEqual([
        [RATE_PRICE, { visible: true }],
        [RATE_CURRENCY, { visible: true }],
      ])
    })

    it('throws when the browser was not launched', async () => {
      await expect(driver.getRate('USD', 'EUR')).rejects.toThrow(/launch the browser first/)
    })

    it('rejects a rate quoted in another currency than the one asked for', async () => {
      await launchWithRate({ text: '0.8877' }, { text: 'GBP' })

      const error = await driver.getRate('USD', 'EUR').catch((e: Error) => e)

      expect((error as Error).message)
        .toBe('Exchange rate USD/EUR is not registered in tradingview.com')
      expect(((error as Error).cause as Error).message).toBe('The rate is quoted in GBP, not EUR')
    })

    it('wraps a missing rate in a "not registered" error with the cause set', async () => {
      await launchWithRate(Error('rate timeout'), { text: 'EUR' })

      const error = await driver.getRate('USD', 'EUR').catch((e: Error) => e)

      expect((error as Error).message)
        .toBe('Exchange rate USD/EUR is not registered in tradingview.com')
      expect(((error as Error).cause as Error).message).toBe('rate timeout')
    })
  })

  it('keeps the requested symbol when the page URL names none', async () => {
    await launchWith({ text: '28.45' }, { text: 'EUR' })
    browser.page.url.mockReturnValue('about:blank')

    await expect(driver.getPrice(QDVE_SETTING)).resolves.toEqual({ price: 28.45, currency: 'EUR' })
  })

  describe('a renamed listing', () => {
    const MOVED = '[data-symbol="EURONEXT:VUAA"]'

    it('reads the quote under the symbol TradingView redirected to', async () => {
      browser = createFakeBrowser(createFakePage({
        [`${MOVED} .js-symbol-last`]: { text: '134.64' },
        [`${MOVED} .js-symbol-currency`]: { text: 'EUR' },
      }))
      browser.page.url.mockReturnValue('https://www.tradingview.com/symbols/EURONEXT-VUAA/')
      driver = new TradingViewDataDriver(fakeLauncher(browser))
      await driver.launchBrowser()

      await expect(driver.getPrice({ ...QDVE_SETTING, tick: 'VUAA', exchange: 'MIL' }))
        .resolves.toEqual({ price: 134.64, currency: 'EUR' })
      expect(browser.page.goto).toHaveBeenCalledWith('https://www.tradingview.com/symbols/MIL-VUAA/')
    })
  })
})

describe('symbolOfUrl', () => {
  it.each([
    ['https://www.tradingview.com/symbols/EURONEXT-VUAA/', 'EURONEXT:VUAA'],
    ['https://www.tradingview.com/symbols/FX_IDC-USDEUR/', 'FX_IDC:USDEUR'],
    ['https://www.tradingview.com/symbols/EURONEXT-GOLD-ETFP/?x=1', 'EURONEXT:GOLD-ETFP'],
    ['https://www.tradingview.com/symbols/LSE-ICOM', 'LSE:ICOM'],
    ['https://www.tradingview.com/symbols/EGX-A%20B/', 'EGX:A B'],
    ['https://www.tradingview.com/symbols/EGX-%C3%89T/', 'EGX:ÉT'],
  ])('reads %s as %s', (url, symbol) => {
    expect(symbolOfUrl(url)).toBe(symbol)
  })

  it.each(['about:blank', 'https://www.tradingview.com/', 'https://www.tradingview.com/symbols/VUAA/'])(
    'has no symbol for %s',
    (url) => {
      expect(symbolOfUrl(url)).toBeUndefined()
    },
  )
})
