import { BrowserController } from '@/Shared/BrowserController'
import { IPriceDataDriver, SettingsDto, SecurityPriceDto } from './IPriceDataDriver.type'

export class JustEtfDataDriver extends BrowserController implements IPriceDataDriver {
  public async getPrice({ isin }: SettingsDto): Promise<SecurityPriceDto> {
    // Launch the browser
    const browser = await this.browser

    if (!isin) {
      throw Error('No ISIN provided to get price')
    }

    // Open a new blank page
    const page = await browser.newPage()
    await page.goto(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`)

    // Locate the price
    try {
      const priceSelect = await page.waitForSelector('#realtime-quotes .val', { timeout: 1000 })
      const fullPrice = await priceSelect?.evaluate((el) => el.textContent)

      const [currency, price] = fullPrice?.split(' ') ?? []

      return {
        price: Number(price),
        currency,
      }
    } catch (e) {
      throw Error(`ISIN '${isin}' is not registered in justetf.com`)
    }
  }
}
