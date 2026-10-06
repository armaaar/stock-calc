import { BrowserController } from '@/Shared/BrowserController.abstract'
import { IPriceDataDriver, SettingsSecurityDto, SecurityPriceDto } from './IPriceDataDriver.type'
import { parsePriceQuote } from './PriceQuote.parser'

export class TradingViewDataDriver extends BrowserController implements IPriceDataDriver {
  public async getPrice({ tick, exchange }: SettingsSecurityDto): Promise<SecurityPriceDto> {
    // Launch the browser
    const browser = this.getBrowser()

    // Open a new blank page
    const page = await browser.newPage()

    try {
      await page.goto(`https://www.tradingview.com/symbols/${exchange}-${tick}/`)
      page.setDefaultTimeout(30000)

      // Locate the price
      const priceSelect = await page.waitForSelector(`[data-symbol="${exchange}:${tick}"] .js-symbol-last`, { visible: true })
      const price = await priceSelect?.evaluate((el) => el.textContent)

      // Locate the currency
      const currencySelect = await page.waitForSelector(`[data-symbol="${exchange}:${tick}"] .js-symbol-currency`, { visible: true })
      const currency = await currencySelect?.evaluate((el) => el.textContent)

      return parsePriceQuote(price, currency)
    } catch (e) {
      throw Error(`Tick '${tick}' at '${exchange}' is not registered in tradingview.com`, { cause: e })
    }
  }
}
