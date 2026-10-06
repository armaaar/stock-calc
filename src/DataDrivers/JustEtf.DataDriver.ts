import { BrowserController } from '#src/Shared/BrowserController.abstract'
import { IPriceDataDriver, SettingsSecurityDto, SecurityPriceDto } from './DataDrivers.type'
import { parsePriceQuote } from './PriceQuote.parser'

/** How long the profile page may take to load, in ms. */
export const JUST_ETF_NAVIGATION_TIMEOUT = 10_000

export class JustEtfDataDriver extends BrowserController implements IPriceDataDriver {
  public readonly name = 'justetf.com'

  public async getPrice({ isin }: SettingsSecurityDto): Promise<SecurityPriceDto> {
    if (!isin) {
      throw Error('No ISIN provided to get price')
    }

    // Launch the browser
    const browser = this.getBrowser()

    // Open a new blank page
    const page = await browser.newPage()

    try {
      // Set before navigating: it's listed first, so the repository waits for it (ADR-0025)
      page.setDefaultNavigationTimeout(JUST_ETF_NAVIGATION_TIMEOUT)
      page.setDefaultTimeout(2000)
      await page.goto(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`)

      // Locate the price: "<CUR> <price>"
      const priceSelect = await page.waitForSelector('#realtime-quotes .val')
      const fullPrice = await priceSelect?.evaluate((el) => el.textContent)

      const [currency, ...price] = (fullPrice ?? '').trim().split(/\s+/)
      return parsePriceQuote(price.join(''), currency)
    } catch (e) {
      throw Error(`ISIN '${isin}' is not registered in justetf.com`, { cause: e })
    }
  }
}
