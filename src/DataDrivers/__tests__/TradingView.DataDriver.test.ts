import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { QDVE_SETTING, withoutIsin } from '#src/__fixtures__/dataFiles'
import {
  createFakeBrowser, createFakePage, FakeBrowser, FakeSelectorResult,
} from '#src/__fixtures__/puppeteer'
import { TradingViewDataDriver } from '../TradingView.DataDriver'

const puppeteer = vi.hoisted(() => ({ launch: vi.fn() }))

vi.mock('puppeteer', () => ({ launch: puppeteer.launch }))

const PRICE_SELECTOR = '[data-symbol="IBIS2:QDVE"] .js-symbol-last'
const CURRENCY_SELECTOR = '[data-symbol="IBIS2:QDVE"] .js-symbol-currency'

const NOT_REGISTERED = 'Tick \'QDVE\' at \'IBIS2\' is not registered in tradingview.com'

describe('TradingViewDataDriver', () => {
  let driver: TradingViewDataDriver
  let browser: FakeBrowser

  async function launchWith(price: FakeSelectorResult, currency: FakeSelectorResult) {
    browser = createFakeBrowser(createFakePage({
      [PRICE_SELECTOR]: price,
      [CURRENCY_SELECTOR]: currency,
    }))
    puppeteer.launch.mockResolvedValue(browser)
    await driver.launchBrowser()
  }

  beforeEach(() => {
    puppeteer.launch.mockReset()
    driver = new TradingViewDataDriver()
  })

  it('throws when the browser was not launched', async () => {
    await expect(driver.getPrice(QDVE_SETTING)).rejects.toThrow(/launch the browser first/)
  })

  it('loads the symbol page with a 30s timeout and reads the visible price and currency', async () => {
    await launchWith({ text: '28.45' }, { text: 'EUR' })

    await expect(driver.getPrice(QDVE_SETTING)).resolves.toEqual({ price: 28.45, currency: 'EUR' })

    const { page } = browser
    expect(browser.newPage).toHaveBeenCalledOnce()
    expect(page.goto).toHaveBeenCalledWith('https://www.tradingview.com/symbols/IBIS2-QDVE/')
    expect(page.setDefaultTimeout).toHaveBeenCalledWith(30000)
    expect(page.waitForSelector.mock.calls).toEqual([
      [PRICE_SELECTOR, { visible: true }],
      [CURRENCY_SELECTOR, { visible: true }],
    ])
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
})
