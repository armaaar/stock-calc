import { BrowserController } from '@/Shared/BrowserController.abstract'
import { IPriceDataDriver, SettingsSecurityDto, SecurityPriceDto } from './IPriceDataDriver.type'

export class JustEtfDataDriver extends BrowserController implements IPriceDataDriver {
  public async getPrice({ isin }: SettingsSecurityDto): Promise<SecurityPriceDto> {
    if (!isin) {
      throw Error('No ISIN provided to get price')
    }

    // Launch the browser
    const browser = this.getBrowser()

    // Open a new blank page
    const page = await browser.newPage()
    await page.goto(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`)
    page.setDefaultTimeout(2000)

    // Locate the price
    try {
      const priceSelect = await page.waitForSelector('#realtime-quotes .val')
      const fullPrice = await priceSelect?.evaluate((el) => el.textContent)

      const [currency, price] = fullPrice?.split(' ') ?? []
      return {
        price: Number(price),
        currency,
      } as SecurityPriceDto
    } catch (e) {
      throw Error(`ISIN '${isin}' is not registered in justetf.com`)
    }
  }
}
