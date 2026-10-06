import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { QDVE_SETTING, withoutIsin } from '@/__fixtures__/dataFiles'
import {
  createFakeBrowser, createFakePage, FakeBrowser, FakeSelectorResult,
} from '@/__fixtures__/puppeteer'
import { TradingViewDataDriver } from '.././TradingView.DataDriver'

const puppeteer = vi.hoisted(() => ({ launch: vi.fn() }))

vi.mock('puppeteer', () => ({ launch: puppeteer.launch }))

const PRICE_SELECTOR = '[data-symbol="IBIS2:QDVE"] .js-symbol-last'
const CURRENCY_SELECTOR = '[data-symbol="IBIS2:QDVE"] .js-symbol-currency'

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
      expect((error as Error).message)
        .toBe('Tick \'QDVE\' at \'IBIS2\' is not registered in tradingview.com')
      expect((error as Error).cause).toBeInstanceOf(Error)
      expect(((error as Error).cause as Error).message).toMatch(/timeout/)
    },
  )

  // Current behaviour: navigation happens outside the try block, so a goto failure is not
  // wrapped in the "not registered" error.
  it('propagates a navigation failure unwrapped', async () => {
    await launchWith({ text: '28.45' }, { text: 'EUR' })
    browser.page.goto.mockRejectedValueOnce(Error('net::ERR_NAME_NOT_RESOLVED'))

    await expect(driver.getPrice(QDVE_SETTING)).rejects.toThrow(/^net::ERR_NAME_NOT_RESOLVED$/)
  })

  // Current behaviour: the scraped text isn't validated. A missing element gives
  // Number(undefined) = NaN, but an element without text gives Number(null) = 0, a valid-looking
  // zero price.
  it('resolves to a NaN price and undefined currency when the selectors return no element', async () => {
    await launchWith(null, null)

    await expect(driver.getPrice(QDVE_SETTING))
      .resolves.toEqual({ price: Number.NaN, currency: undefined })
  })

  it('resolves to a 0 price and null currency when the elements have no text', async () => {
    await launchWith({ text: null }, { text: null })

    await expect(driver.getPrice(QDVE_SETTING)).resolves.toEqual({ price: 0, currency: null })
  })

  // Current behaviour: thousands separators are not handled, so large prices become NaN.
  it('resolves to a NaN price for a price with a thousands separator', async () => {
    await launchWith({ text: '1,234.56' }, { text: 'USD' })

    await expect(driver.getPrice(QDVE_SETTING))
      .resolves.toEqual({ price: Number.NaN, currency: 'USD' })
  })

  // Current behaviour: pages are never closed; they're cleaned up when the browser closes.
  it('does not close the page it opened', async () => {
    await launchWith({ text: '28.45' }, { text: 'EUR' })

    await driver.getPrice(QDVE_SETTING)

    expect(browser.page.close).not.toHaveBeenCalled()
    expect(browser.close).not.toHaveBeenCalled()
  })
})
