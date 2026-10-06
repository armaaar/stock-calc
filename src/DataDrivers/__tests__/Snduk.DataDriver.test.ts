import { describe, expect, it, vi } from 'vitest'
import { BMM_FUND, sndukFundPage } from '#src/__fixtures__/snduk'
import type { SettingsSecurityDto } from '../DataDrivers.type'
import {
  PageFetcher, SNDUK_TIMEOUT, SNDUK_USER_AGENT, SndukDataDriver,
} from '../Snduk.DataDriver'

const BMM_SETTING: SettingsSecurityDto = {
  tick: 'BMM', exchange: 'EGX', snduk: 'beltone-meya-100', shares: 1000, targetPercentage: 1,
}

const NOT_REGISTERED = 'Fund \'beltone-meya-100\' is not registered in snduk.com'

/** A fetch that answers every request with this page and status. */
function fakeFetch(html: string, status = 200) {
  return vi.fn<PageFetcher>(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => html,
  }))
}

async function causeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(() => undefined, (e: unknown) => e) as Error
  expect(error.message).toBe(NOT_REGISTERED)
  return (error.cause as Error).message
}

describe('SndukDataDriver', () => {
  it('names itself snduk.com, for the quotes it gives', () => {
    expect(new SndukDataDriver(fakeFetch('')).name).toBe('snduk.com')
  })

  it('reads the NAV, its currency and its date from the fund page', async () => {
    const fetchPage = fakeFetch(sndukFundPage(BMM_FUND))

    await expect(new SndukDataDriver(fetchPage).getPrice(BMM_SETTING))
      .resolves.toEqual({ price: 2.4326, currency: 'EGP', quotedAt: '2026-10-06' })

    expect(fetchPage).toHaveBeenCalledOnce()
    const [url, init] = fetchPage.mock.calls[0]
    expect(url).toBe('https://snduk.com/eg/funds/beltone-meya-100?lang=en')
    expect(init.headers).toEqual({ 'user-agent': SNDUK_USER_AGENT })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(SNDUK_TIMEOUT).toBe(15_000)
  })

  it('leaves the date out when the page has none', async () => {
    const fetchPage = fakeFetch(sndukFundPage({ ...BMM_FUND, lastPriceUpdate: null }))

    await expect(new SndukDataDriver(fetchPage).getPrice(BMM_SETTING))
      .resolves.toEqual({ price: 2.4326, currency: 'EGP', quotedAt: undefined })
  })

  it('takes the record whose code is the tick, ignoring case, when the page has several', async () => {
    const other = { ...BMM_FUND, code: 'AZ30', currency: 'USD', currentPrice: 10.1621 }
    const fetchPage = fakeFetch(sndukFundPage(other, { ...BMM_FUND, code: 'bmm' }))

    await expect(new SndukDataDriver(fetchPage).getPrice(BMM_SETTING))
      .resolves.toMatchObject({ price: 2.4326, currency: 'EGP' })
  })

  it('reads a numeric NAV', async () => {
    const fetchPage = fakeFetch(sndukFundPage({ ...BMM_FUND, currentPrice: 2.5 }))

    await expect(new SndukDataDriver(fetchPage).getPrice(BMM_SETTING))
      .resolves.toMatchObject({ price: 2.5 })
  })

  it('asks for nothing when the security names no fund page', async () => {
    const fetchPage = fakeFetch('')
    const { snduk, ...withoutPage } = BMM_SETTING

    await expect(new SndukDataDriver(fetchPage).getPrice(withoutPage))
      .rejects.toThrow('No snduk.com fund page set')
    expect(snduk).toBe('beltone-meya-100')
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('rejects a page for another fund, naming it', async () => {
    const fetchPage = fakeFetch(sndukFundPage({ ...BMM_FUND, code: 'AZ30' }))

    expect(await causeOf(new SndukDataDriver(fetchPage).getPrice(BMM_SETTING)))
      .toBe('The page is for \'AZ30\', not \'BMM\'')
  })

  it.each([
    [404, 'The fund page answered HTTP 404'],
    [503, 'The fund page answered HTTP 503'],
  ])('rejects an HTTP %i answer', async (status, cause) => {
    const fetchPage = fakeFetch('Not found', status)

    expect(await causeOf(new SndukDataDriver(fetchPage).getPrice(BMM_SETTING))).toBe(cause)
  })

  it('rejects a page without a fund record', async () => {
    const fetchPage = fakeFetch('<html>Sign in</html>')

    expect(await causeOf(new SndukDataDriver(fetchPage).getPrice(BMM_SETTING)))
      .toBe('No fund record found in the page')
  })

  it.each([
    ['no NAV', { currentPrice: null }, 'No price text found'],
    ['a zero NAV', { currentPrice: '0' }, 'Price \'0\' is not a positive number'],
  ])('rejects a fund with %s', async (_, change, cause) => {
    const fetchPage = fakeFetch(sndukFundPage({ ...BMM_FUND, ...change }))

    expect(await causeOf(new SndukDataDriver(fetchPage).getPrice(BMM_SETTING))).toBe(cause)
  })

  it('wraps a failed request, such as a timeout', async () => {
    const fetchPage = vi.fn<PageFetcher>().mockRejectedValue(Error('The operation was aborted'))

    expect(await causeOf(new SndukDataDriver(fetchPage).getPrice(BMM_SETTING)))
      .toBe('The operation was aborted')
  })

  it('has no browser to launch or close', async () => {
    const driver = new SndukDataDriver(fakeFetch(''))

    await expect(driver.launchBrowser()).resolves.toBeUndefined()
    await expect(driver.closeBrowser()).resolves.toBeUndefined()
  })
})
