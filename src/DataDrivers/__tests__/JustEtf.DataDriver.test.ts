import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { QDVE_SETTING, withoutIsin } from '@/__fixtures__/dataFiles'
import {
  createFakeBrowser, createFakePage, FakeBrowser, FakeSelectorResult,
} from '@/__fixtures__/puppeteer'
import { JustEtfDataDriver } from '.././JustEtf.DataDriver'

const puppeteer = vi.hoisted(() => ({ launch: vi.fn() }))

vi.mock('puppeteer', () => ({ launch: puppeteer.launch }))

const PRICE_SELECTOR = '#realtime-quotes .val'

describe('JustEtfDataDriver', () => {
  let driver: JustEtfDataDriver
  let browser: FakeBrowser

  async function launchWith(result: FakeSelectorResult) {
    browser = createFakeBrowser(createFakePage({ [PRICE_SELECTOR]: result }))
    puppeteer.launch.mockResolvedValue(browser)
    await driver.launchBrowser()
  }

  beforeEach(() => {
    puppeteer.launch.mockReset()
    driver = new JustEtfDataDriver()
  })

  it('throws when the security has no ISIN, without touching the browser', async () => {
    const noIsin = withoutIsin(QDVE_SETTING)

    await expect(driver.getPrice(noIsin)).rejects.toThrow('No ISIN provided to get price')
    expect(puppeteer.launch).not.toHaveBeenCalled()
  })

  it('throws when the browser was not launched', async () => {
    await expect(driver.getPrice(QDVE_SETTING)).rejects.toThrow(/launch the browser first/)
  })

  it('loads the ETF profile by ISIN with a 2s timeout and parses "<CUR> <price>"', async () => {
    await launchWith({ text: 'EUR 28.45' })

    await expect(driver.getPrice(QDVE_SETTING)).resolves.toEqual({ price: 28.45, currency: 'EUR' })

    const { page } = browser
    expect(browser.newPage).toHaveBeenCalledOnce()
    expect(page.goto)
      .toHaveBeenCalledWith('https://www.justetf.com/en/etf-profile.html?isin=IE00B3WJKG14')
    expect(page.setDefaultTimeout).toHaveBeenCalledWith(2000)
    expect(page.waitForSelector).toHaveBeenCalledWith(PRICE_SELECTOR)
  })

  it('wraps a selector failure in a "not registered" error with the cause set', async () => {
    const timeout = Error('Waiting for selector timed out')
    await launchWith(timeout)

    const error = await driver.getPrice(QDVE_SETTING).catch((e: Error) => e)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('ISIN \'IE00B3WJKG14\' is not registered in justetf.com')
    expect((error as Error).cause).toBe(timeout)
  })

  // Current behaviour: navigation happens outside the try block, so a goto failure is not
  // wrapped in the "not registered" error.
  it('propagates a navigation failure unwrapped', async () => {
    await launchWith({ text: 'EUR 28.45' })
    browser.page.goto.mockRejectedValueOnce(Error('net::ERR_NAME_NOT_RESOLVED'))

    await expect(driver.getPrice(QDVE_SETTING)).rejects.toThrow(/^net::ERR_NAME_NOT_RESOLVED$/)
  })

  // Current behaviour: the scraped text isn't validated, so a missing element/text resolves to
  // a NaN price and an undefined currency instead of rejecting.
  it('resolves to a NaN price when the selector returns no element', async () => {
    await launchWith(null)

    await expect(driver.getPrice(QDVE_SETTING))
      .resolves.toEqual({ price: Number.NaN, currency: undefined })
  })

  it('resolves to a NaN price when the element has no text', async () => {
    await launchWith({ text: null })

    await expect(driver.getPrice(QDVE_SETTING))
      .resolves.toEqual({ price: Number.NaN, currency: undefined })
  })

  // Current behaviour: thousands separators are not handled, so large prices become NaN.
  it('resolves to a NaN price for a price with a thousands separator', async () => {
    await launchWith({ text: 'EUR 1,234.56' })

    await expect(driver.getPrice(QDVE_SETTING))
      .resolves.toEqual({ price: Number.NaN, currency: 'EUR' })
  })

  // Current behaviour: pages are never closed; they're cleaned up when the browser closes.
  it('does not close the page it opened', async () => {
    await launchWith({ text: 'EUR 28.45' })

    await driver.getPrice(QDVE_SETTING)

    expect(browser.page.close).not.toHaveBeenCalled()
    expect(browser.close).not.toHaveBeenCalled()
  })
})
