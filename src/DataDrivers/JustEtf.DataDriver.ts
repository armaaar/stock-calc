import { BrowserController } from '#src/Shared/BrowserController.abstract'
import { IPriceDataDriver, SettingsSecurityDto, SecurityPriceDto } from './DataDrivers.type'
import { parsePriceQuote } from './PriceQuote.parser'

/** How long the profile page may take to load, in ms. */
export const JUST_ETF_NAVIGATION_TIMEOUT = 10_000

/**
 * How long an ETF's profile may take to show its quote once loaded, in ms. The quote widget
 * fetches it after the page loads, usually within a second, slower when many pages load at once.
 */
export const JUST_ETF_QUOTE_TIMEOUT = 10_000

/** The quote widget, in every ETF profile's HTML. An unknown ISIN redirects to a search page. */
const QUOTES_SELECTOR = '#realtime-quotes'

export class JustEtfDataDriver extends BrowserController implements IPriceDataDriver {
  public readonly name = 'justetf.com'

  public async getPrice({ isin }: SettingsSecurityDto): Promise<SecurityPriceDto> {
    if (!isin) {
      throw Error('No ISIN provided to get price')
    }

    // Open a new blank page, visible in its own window
    const page = await this.newPage()

    try {
      // Set before navigating: it's listed first, so the repository waits for it (ADR-0025)
      page.setDefaultNavigationTimeout(JUST_ETF_NAVIGATION_TIMEOUT)
      page.setDefaultTimeout(JUST_ETF_QUOTE_TIMEOUT)
      await page.goto(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`)

      // No ETF profile: give up at once instead of waiting for a quote that can't come
      if (!await page.$(QUOTES_SELECTOR)) {
        throw Error(`No ETF profile at ${page.url()}`)
      }

      // Locate the price: "<CUR> <price>"
      const priceSelect = await page.waitForSelector(`${QUOTES_SELECTOR} .val`)
      const fullPrice = await priceSelect?.evaluate((el) => el.textContent)

      const [currency, ...price] = (fullPrice ?? '').trim().split(/\s+/)
      return parsePriceQuote(price.join(''), currency)
    } catch (e) {
      throw Error(`ISIN '${isin}' is not registered in justetf.com`, { cause: e })
    }
  }
}
