import { launch } from 'puppeteer'
import { IPriceDataDriver, SettingsDto, SecurityPriceDto } from './IPriceDataDriver.type'

export class JustEtfDataDriver implements IPriceDataDriver {
  public async getPrice({ isin }: SettingsDto): Promise<SecurityPriceDto> {
    if (!isin) {
      throw Error('No ISIN provided to get price')
    }

    // Launch the browser
    const browser = await launch({ headless: 'new' })

    // Open a new blank page
    const page = await browser.newPage()
    await page.goto(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`)
    page.setDefaultTimeout(1000)

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
    } finally {
      await page.close()
      await browser.close()
    }
  }
}
