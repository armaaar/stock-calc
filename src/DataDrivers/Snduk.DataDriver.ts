import {
  IPriceDataDriver, isMutualFund, LiveQuoteDto, SettingsSecurityDto,
} from './DataDrivers.type'
import { parsePriceQuote } from './PriceQuote.parser'
import { parseSndukFunds } from './SndukFund.parser'

/** Fetches a page. Production passes the global `fetch`; tests pass a fake. */
export type PageFetcher = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>

/** How long a fund page may take to load, in ms. */
export const SNDUK_TIMEOUT = 15_000

/** Says who is asking, as robots.txt etiquette expects. */
export const SNDUK_USER_AGENT = 'stock-calc (+https://github.com/armaaar/stock-calc)'

/**
 * Egyptian mutual funds' NAVs from snduk.com, which lists the funds of every manager. A fund is
 * bought at its NAV, not on an exchange, so the price sources that read exchanges don't list it.
 * The fund page (`snduk.com/eg/funds/<slug>`, allowed by its robots.txt) renders on the server, so
 * a plain HTTP request reads it: no browser is needed.
 */
export class SndukDataDriver implements IPriceDataDriver {
  public readonly name = 'snduk.com'

  /** @param timeout how long a fund page may take to load, in ms */
  constructor(
    private readonly fetchPage: PageFetcher,
    private readonly timeout: number = SNDUK_TIMEOUT,
  ) {}

  /** No browser to start. */
  public async launchBrowser(): Promise<void> {}

  /** No browser to close. */
  public async closeBrowser(): Promise<void> {}

  public canPrice(setting: SettingsSecurityDto): boolean {
    return isMutualFund(setting)
  }

  public async getPrice({ tick, snduk }: SettingsSecurityDto): Promise<LiveQuoteDto> {
    if (!snduk) {
      throw Error('No snduk.com fund page set')
    }

    try {
      const response = await this.fetchPage(`https://snduk.com/eg/funds/${snduk}?lang=en`, {
        headers: { 'user-agent': SNDUK_USER_AGENT },
        signal: AbortSignal.timeout(this.timeout),
      })
      if (!response.ok) {
        throw Error(`The fund page answered HTTP ${response.status}`)
      }

      // The page holds its own fund's record, and maybe others': take the one with this code
      const funds = parseSndukFunds(await response.text())
      const fund = funds.find(({ code }) => code.toUpperCase() === tick.toUpperCase())
      if (!fund) {
        throw Error(`The page is for ${funds.map(({ code }) => `'${code}'`).join(', ')}, not '${tick}'`)
      }

      // A NAV without its date can't say how old it is: it mustn't pass for today's
      if (!fund.lastPriceUpdate) {
        throw Error(`The page gives no date for the NAV of '${fund.code}'`)
      }
      return {
        ...parsePriceQuote(fund.currentPrice?.toString(), fund.currency),
        // The NAV's own date, so the plan shows how old it is, not when it was read
        quotedAt: fund.lastPriceUpdate,
      }
    } catch (e) {
      throw Error(`Fund '${snduk}' is not registered in snduk.com`, { cause: e })
    }
  }
}
