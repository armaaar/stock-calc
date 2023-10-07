import { BrowserController } from '@/Shared/BrowserController.abstract'
import { IPriceDataDriver, SettingsDto, SecurityPriceDto } from './IPriceDataDriver.type'

export class TradingViewDataDriver extends BrowserController implements IPriceDataDriver {
  public async getPrice({ tick, exchange }: SettingsDto): Promise<SecurityPriceDto> {
    // Launch the browser
    const browser = this.getBrowser()

    // Open a new blank page
    const page = await browser.newPage()
    await page.goto(`https://www.tradingview.com/symbols/${exchange}-${tick}/`)
    page.setDefaultTimeout(5000)

    try {
      // Locate the price
      const priceSelect = await page.waitForSelector(`[data-symbol="${exchange}:${tick}"] .js-symbol-last`, { visible: true })
      const price = await priceSelect?.evaluate((el) => el.textContent)

      // Locate the currency
      const currencySelect = await page.waitForSelector(`[data-symbol="${exchange}:${tick}"] .js-symbol-currency`, { visible: true })
      const currency = await currencySelect?.evaluate((el) => el.textContent)

      return {
        price: Number(price),
        currency,
      } as SecurityPriceDto
    } catch (e) {
      throw Error(`Tick '${tick}' at '${exchange}' is not registered in tradingview.com`)
    } finally {
      if (!page.isClosed()) {
        page.close()
      }
    }
  }
}
