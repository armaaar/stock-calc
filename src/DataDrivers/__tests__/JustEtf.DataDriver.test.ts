import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { QDVE_SETTING, withoutIsin } from '#src/__fixtures__/dataFiles'
import {
  createFakeBrowser, createFakePage, FakeBrowser, fakeLauncher, FakeSelectorResult,
} from '#src/__fixtures__/puppeteer'
import { JustEtfDataDriver } from '../JustEtf.DataDriver'

const QUOTES_SELECTOR = '#realtime-quotes'
const PRICE_SELECTOR = '#realtime-quotes .val'
const PROFILE_URL = 'https://www.justetf.com/en/etf-profile.html?isin=IE00B3WJKG14'

const NOT_REGISTERED = 'ISIN \'IE00B3WJKG14\' is not registered in justetf.com'

describe('JustEtfDataDriver', () => {
  let driver: JustEtfDataDriver
  let browser: FakeBrowser
  let launch: ReturnType<typeof fakeLauncher>

  async function launchWith(result: FakeSelectorResult) {
    browser = createFakeBrowser(createFakePage({
      [QUOTES_SELECTOR]: { text: '' },
      [PRICE_SELECTOR]: result,
    }))
    launch = fakeLauncher(browser)
    driver = new JustEtfDataDriver(launch)
    await driver.launchBrowser()
  }

  beforeEach(() => {
    launch = fakeLauncher()
    driver = new JustEtfDataDriver(launch)
  })

  it('names itself justetf.com, for the quotes it gives', () => {
    expect(driver.name).toBe('justetf.com')
  })

  it('throws when the security has no ISIN, without touching the browser', async () => {
    const noIsin = withoutIsin(QDVE_SETTING)

    await expect(driver.getPrice(noIsin)).rejects.toThrow('No ISIN provided to get price')
    expect(launch).not.toHaveBeenCalled()
  })

  it('checks the ISIN before opening a page in a launched browser', async () => {
    await launchWith({ text: 'EUR 28.45' })
    const noIsin = withoutIsin(QDVE_SETTING)

    await expect(driver.getPrice(noIsin)).rejects.toThrow('No ISIN provided to get price')
    expect(browser.newPage).not.toHaveBeenCalled()
  })

  it('throws when the browser was not launched', async () => {
    await expect(driver.getPrice(QDVE_SETTING)).rejects.toThrow(/launch the browser first/)
  })

  it('loads the ETF profile by ISIN with 10s limits and parses "<CUR> <price>"', async () => {
    await launchWith({ text: 'EUR 28.45' })

    await expect(driver.getPrice(QDVE_SETTING)).resolves.toEqual({ price: 28.45, currency: 'EUR' })

    const { page } = browser
    expect(launch).toHaveBeenCalledOnce()
    expect(browser.newPage).toHaveBeenCalledOnce()
    expect(page.goto).toHaveBeenCalledWith(PROFILE_URL)
    expect(page.setDefaultTimeout).toHaveBeenCalledWith(10_000)
    expect(page.setDefaultNavigationTimeout).toHaveBeenCalledWith(10_000)
    // Both limits apply to the navigation too, so they must be set before it
    const gotoOrder = page.goto.mock.invocationCallOrder[0]
    expect(page.setDefaultTimeout.mock.invocationCallOrder[0]).toBeLessThan(gotoOrder)
    expect(page.setDefaultNavigationTimeout.mock.invocationCallOrder[0]).toBeLessThan(gotoOrder)
    expect(page.waitForSelector).toHaveBeenCalledWith(PRICE_SELECTOR)
  })

  // A background tab is hidden, and puppeteer's visibility polling stalls in a hidden page
  it('opens its page in a window of its own, so the page is visible', async () => {
    await launchWith({ text: 'EUR 28.45' })

    await driver.getPrice(QDVE_SETTING)

    expect(browser.newPage).toHaveBeenCalledWith({ type: 'window' })
  })

  it('checks the loaded page is an ETF profile before waiting for its quote', async () => {
    await launchWith({ text: 'EUR 28.45' })

    await driver.getPrice(QDVE_SETTING)

    const { page } = browser
    expect(page.$).toHaveBeenCalledWith(QUOTES_SELECTOR)
    expect(page.goto.mock.invocationCallOrder[0])
      .toBeLessThan(page.$.mock.invocationCallOrder[0])
    expect(page.$.mock.invocationCallOrder[0])
      .toBeLessThan(page.waitForSelector.mock.invocationCallOrder[0])
  })

  it('gives up at once when an unknown ISIN redirects away from the profile', async () => {
    browser = createFakeBrowser(createFakePage({ [PRICE_SELECTOR]: { text: 'EUR 28.45' } }))
    driver = new JustEtfDataDriver(fakeLauncher(browser))
    await driver.launchBrowser()
    const search = 'https://www.justetf.com/en/search.html?query=IE00B3WJKG14&search=ETFS'
    browser.page.url.mockReturnValue(search)

    const error = await driver.getPrice(QDVE_SETTING).catch((e: Error) => e)

    expect((error as Error).message).toBe(NOT_REGISTERED)
    expect(((error as Error).cause as Error).message).toBe(`No ETF profile at ${search}`)
    expect(browser.page.waitForSelector).not.toHaveBeenCalled()
  })

  it('wraps a selector failure in a "not registered" error with the cause set', async () => {
    const timeout = Error('Waiting for selector timed out')
    await launchWith(timeout)

    const error = await driver.getPrice(QDVE_SETTING).catch((e: Error) => e)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(NOT_REGISTERED)
    expect((error as Error).cause).toBe(timeout)
  })

  it('wraps a navigation failure in a "not registered" error with the cause set', async () => {
    await launchWith({ text: 'EUR 28.45' })
    const navigation = Error('net::ERR_NAME_NOT_RESOLVED')
    browser.page.goto.mockRejectedValueOnce(navigation)

    const error = await driver.getPrice(QDVE_SETTING).catch((e: Error) => e)

    expect((error as Error).message).toBe(NOT_REGISTERED)
    expect((error as Error).cause).toBe(navigation)
    expect(browser.page.waitForSelector).not.toHaveBeenCalled()
  })

  it.each([
    ['no element', null, 'No price text found'],
    ['an element without text', { text: null }, 'No price text found'],
    ['an empty text', { text: '  ' }, 'No price text found'],
    ['a currency only', { text: 'EUR' }, 'No price text found'],
    ['a zero price', { text: 'EUR 0.00' }, 'Price \'0.00\' is not a positive number'],
    ['a non-numeric price', { text: 'EUR n/a' }, 'Price \'n/a\' is not a positive number'],
  ] as const)('rejects %s with a "not registered" error caused by the parser', async (
    _case,
    result,
    cause,
  ) => {
    await launchWith(result)

    const error = await driver.getPrice(QDVE_SETTING).catch((e: Error) => e)

    expect((error as Error).message).toBe(NOT_REGISTERED)
    expect(((error as Error).cause as Error).message).toBe(cause)
  })

  it.each([
    ['a thousands separator', 'EUR 1,234.56'],
    ['a no-break space', 'EUR\u00a01,234.56'],
    ['a narrow no-break space as thousands separator', 'EUR 1\u202f234.56'],
    ['surrounding whitespace', '\n  EUR   1234.56 \n'],
  ])('parses a price with %s', async (_case, text) => {
    await launchWith({ text })

    await expect(driver.getPrice(QDVE_SETTING))
      .resolves.toEqual({ price: 1234.56, currency: 'EUR' })
  })

  // By design (ADR-0006): pages are never closed; they're cleaned up when the browser closes.
  it('does not close the page it opened', async () => {
    await launchWith({ text: 'EUR 28.45' })

    await driver.getPrice(QDVE_SETTING)

    expect(browser.page.close).not.toHaveBeenCalled()
    expect(browser.close).not.toHaveBeenCalled()
  })
})
