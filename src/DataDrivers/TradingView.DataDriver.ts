import type { Page } from 'puppeteer'
import { BrowserController } from '#src/Shared/BrowserController.abstract'
import {
  IExchangeRateDataDriver, IPriceDataDriver, SettingsSecurityDto, SecurityPriceDto,
} from './DataDrivers.type'
import { parsePriceQuote } from './PriceQuote.parser'

/** TradingView's exchange for currency pairs: `FX_IDC:USDEUR` is what 1 USD is worth in EUR. */
export const FX_EXCHANGE = 'FX_IDC'

/**
 * The `<EXCHANGE>:<TICK>` a symbol page shows, from its URL (`/symbols/EURONEXT-VUAA/`). Exchange
 * names have no '-'; ticks may.
 */
export function symbolOfUrl(url: string): string | undefined {
  const match = /\/symbols\/([^/-]+)-([^/]+)\/?$/.exec(new URL(url).pathname)
  return match ? `${match[1]}:${match[2]}` : undefined
}

export class TradingViewDataDriver extends BrowserController
  implements IPriceDataDriver, IExchangeRateDataDriver {
  public readonly name = 'tradingview.com'

  public async getPrice({ tick, exchange }: SettingsSecurityDto): Promise<SecurityPriceDto> {
    const page = await this.newPage()
    try {
      return await this.readQuote(page, exchange, tick)
    } catch (e) {
      throw Error(`Tick '${tick}' at '${exchange}' is not registered in tradingview.com`, { cause: e })
    }
  }

  public async getRate(from: string, to: string): Promise<number> {
    const page = await this.newPage()
    try {
      const { price, currency } = await this.readQuote(page, FX_EXCHANGE, `${from}${to}`)
      if (currency !== to) {
        throw Error(`The rate is quoted in ${currency}, not ${to}`)
      }
      return price
    } catch (e) {
      throw Error(`Exchange rate ${from}/${to} is not registered in tradingview.com`, { cause: e })
    }
  }

  /** A new blank page in the launched browser. */
  private async newPage(): Promise<Page> {
    return this.getBrowser().newPage()
  }

  /** The visible last price and its currency on the symbol page of `<exchange>:<tick>`. */
  private async readQuote(page: Page, exchange: string, tick: string): Promise<SecurityPriceDto> {
    page.setDefaultTimeout(30000)
    await page.goto(`https://www.tradingview.com/symbols/${exchange}-${tick}/`)
    // A listing TradingView renamed redirects to its new symbol (MIL:VUAA to EURONEXT:VUAA), and
    // the page shows the quote under that one
    const symbol = symbolOfUrl(page.url()) ?? `${exchange}:${tick}`

    // Locate the price
    const priceSelect = await page.waitForSelector(`[data-symbol="${symbol}"] .js-symbol-last`, { visible: true })
    const price = await priceSelect?.evaluate((el) => el.textContent)

    // Locate the currency
    const currencySelect = await page.waitForSelector(`[data-symbol="${symbol}"] .js-symbol-currency`, { visible: true })
    const currency = await currencySelect?.evaluate((el) => el.textContent)

    return parsePriceQuote(price, currency)
  }
}
