import {
  IExchangeRateDataDriver,
  IOverridesDataDriver,
  IPriceDataDriver,
  ISettingsDataDriver,
  OverridesDto,
  SettingsSecurityDto,
} from '#src/DataDrivers/DataDrivers.type'
import type { IExchangeRate } from '#src/Entities/ExchangeRate.ValueObject'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { IPortfolioSecurity, PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'
import { IPortfolioRepository } from '#src/UseCases/IPortfolioRepository.type'

/** Where the repository reads a portfolio from. */
export interface PortfolioDataDrivers {
  settings: ISettingsDataDriver
  overrides: IOverridesDataDriver
  /**
   * Asked together for every price that isn't overridden. The first source in this list that
   * can price a security wins, however fast the others answer.
   */
  prices: IPriceDataDriver[]
  /**
   * Asked the same way for every exchange rate that isn't overridden: one per currency a
   * security is listed in, other than the portfolio's. A source may also be a price source.
   */
  rates: IExchangeRateDataDriver[]
}

/** A price with where and when it was quoted, ready for the domain's `PriceQuote`. */
type SourcedPrice = Pick<IPortfolioSecurity, 'price' | 'currency' | 'priceSource' | 'pricedAt'>

/** A source the repository launches, asks and closes. */
type LiveSource = Pick<IPriceDataDriver, 'name' | 'launchBrowser' | 'closeBrowser'>

export const OVERRIDE_SOURCE = 'override'

/** Own keys only, so a tick like 'toString' isn't "overridden" by Object.prototype. */
function isOverridden(key: string, overrides: Record<string, unknown>): boolean {
  return Object.hasOwn(overrides, key)
}

/** A rate override that doesn't convert into the portfolio's currency could never be used. */
function assertRatesConvertInto(currency: string | undefined, overrides: OverridesDto): void {
  const unused = Object.keys(overrides.rates).filter((pair) => !pair.endsWith(`/${currency}`))
  if (unused.length > 0) {
    throw Error(
      `The rate override ${unused.join(', ')} doesn't convert into the portfolio's currency `
      + `(${currency ?? 'not set'}): rates are keyed <FROM>/${currency ?? '<portfolio currency>'}`,
    )
  }
}

export class PortfolioRepository implements IPortfolioRepository {
  /** @param now the clock that time-stamps live prices and rates */
  constructor(
    private readonly dataDrivers: PortfolioDataDrivers,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async getPortfolio(portfolioId?: string): Promise<Portfolio> {
    let portfolio: Portfolio
    try {
      portfolio = await this.loadPortfolio(portfolioId)
    } catch (error) {
      // A browser that fails to close must not hide why the portfolio couldn't be loaded
      await Promise.allSettled(this.closeBrowsers())
      throw error
    }

    await Promise.all(this.closeBrowsers())
    return portfolio
  }

  /** Every source once, even one that gives both prices and rates. */
  private get liveSources(): LiveSource[] {
    return [...new Set<LiveSource>([...this.dataDrivers.prices, ...this.dataDrivers.rates])]
  }

  /** Closing a browser that was never launched is a no-op. */
  private closeBrowsers(): Promise<void>[] {
    return this.liveSources.map((source) => source.closeBrowser())
  }

  private async loadPortfolio(requestedId?: string): Promise<Portfolio> {
    const { settings, overrides: overridesDD, prices } = this.dataDrivers

    const portfolioId = await settings.resolvePortfolioId(requestedId)
    const {
      currency, brokerageFeeFlat, tradingFeePercentage, minimumTradingFeeFlat, fxFeePercentage,
      cash, feeWarningPercentage, securities,
    } = await settings.getPortfolioSettings(portfolioId)
    const overrides = await overridesDD.getPortfolioOverrides(portfolioId)
    // Before anything is scraped, so a mistyped key fails fast and isn't hidden by a price error
    assertRatesConvertInto(currency, overrides)

    // Only start the browsers of sources that some price to scrape needs: none when every price
    // is overridden, only snduk.com (no browser) for a portfolio of funds. They start together,
    // so a cold start costs the slowest launch, not the sum. If one fails, closing them waits
    // for any launch still in flight (BrowserController), so nothing is left running.
    const scraped = securities.filter(({ tick }) => !isOverridden(tick, overrides.prices))
    await Promise.all(prices
      .filter((priceDD) => scraped.some((security) => priceDD.canPrice(security)))
      .map((priceDD) => priceDD.launchBrowser()))

    const quotes = await Promise.all(
      securities.map((security) => this.getPrice(security, overrides)),
    )
    const rates = await this.getRates(quotes, currency, overrides)

    const portfolioSecurities: IPortfolioSecurity[] = securities.map((security, i) => {
      const {
        tick, isin, shares, targetPercentage, exchange,
      } = security
      return {
        tick,
        isin,
        ...quotes[i],
        exchangeRate: rates.get(quotes[i].currency as string),
        shares,
        targetPercentage,
        exchange,
        // A fee part the security doesn't set falls back to the portfolio's, part by part
        brokerageFeeFlat: security.brokerageFeeFlat ?? brokerageFeeFlat,
        tradingFeePercentage: security.tradingFeePercentage ?? tradingFeePercentage,
        minimumTradingFeeFlat: security.minimumTradingFeeFlat ?? minimumTradingFeeFlat,
        fxFeePercentage: security.fxFeePercentage ?? fxFeePercentage,
      }
    })

    return new Portfolio({
      id: portfolioId,
      currency,
      securities: portfolioSecurities.map((s) => new PortfolioSecurity(s)),
      cash,
      feeWarningPercentage,
    })
  }

  private async getPrice(
    setting: SettingsSecurityDto,
    overrides: OverridesDto,
  ): Promise<SourcedPrice> {
    if (isOverridden(setting.tick, overrides.prices)) {
      const { price, currency, asOf } = overrides.prices[setting.tick]
      if (setting.currency !== undefined && currency !== setting.currency) {
        throw Error(
          `The override for '${setting.tick}' is in ${currency}, but it is traded in ${setting.currency}`,
        )
      }
      return {
        price,
        currency,
        priceSource: OVERRIDE_SOURCE,
        // A date: the time of day of a hand-entered price isn't known
        pricedAt: asOf,
      }
    }

    // Only the sources that look a security up by what its settings name: a mutual fund only by
    // its fund page, never by an exchange listing that shares its code (ADR-0029)
    const sources = this.dataDrivers.prices.filter((priceDD) => priceDD.canPrice(setting))
    // An empty AggregateError would name no security
    if (sources.length === 0) {
      throw Error(`No price source for '${setting.tick}': add its price to the overrides`)
    }

    const { value, source } = await this.firstAnswer(
      sources,
      async (priceDD) => {
        const quote = await priceDD.getPrice(setting)
        // Another listing of the security: let the next source price this one
        if (setting.currency !== undefined && quote.currency !== setting.currency) {
          throw Error(
            `${priceDD.name} quoted '${setting.tick}' in ${quote.currency}, `
            + `but it is traded in ${setting.currency}`,
          )
        }
        return quote
      },
      `No price source could price '${setting.tick}'`
      + (setting.currency === undefined ? '' : ` in ${setting.currency}`)
      + ': check its tick, exchange and isin, or add its price to the overrides',
    )
    return {
      price: value.price,
      currency: value.currency,
      priceSource: source,
      // When the source dates its price (a fund's NAV date), the plan shows that date
      pricedAt: value.quotedAt ?? this.now().toISOString(),
    }
  }

  /**
   * The rate into the portfolio's currency for each other currency a security is listed in,
   * keyed by that currency. Without a portfolio currency, nothing is converted.
   */
  private async getRates(
    quotes: SourcedPrice[],
    currency: string | undefined,
    overrides: OverridesDto,
  ): Promise<Map<string, IExchangeRate>> {
    if (currency === undefined) return new Map()
    const listed = [...new Set(quotes.map((quote) => quote.currency as string))]
      .filter((from) => from !== currency)

    const pair = (from: string) => `${from}/${currency}`
    if (listed.some((from) => !isOverridden(pair(from), overrides.rates))) {
      await Promise.all(this.dataDrivers.rates.map((rateDD) => rateDD.launchBrowser()))
    }

    const rates = await Promise.all(listed.map(async (from): Promise<IExchangeRate> => {
      if (isOverridden(pair(from), overrides.rates)) {
        const { rate, asOf } = overrides.rates[pair(from)]
        return {
          from, to: currency, rate, source: OVERRIDE_SOURCE, quotedAt: asOf,
        }
      }

      if (this.dataDrivers.rates.length === 0) {
        throw Error(`No exchange-rate source for ${pair(from)}: add "${pair(from)}" to the overrides`)
      }
      const { value, source } = await this.firstAnswer(
        this.dataDrivers.rates,
        (rateDD) => rateDD.getRate(from, currency),
        `No exchange-rate source could convert ${pair(from)}`,
      )
      return {
        from, to: currency, rate: value, source, quotedAt: this.now().toISOString(),
      }
    }))
    return new Map(rates.map((rate) => [rate.from, rate]))
  }

  /**
   * Asks every source at once, but takes the answers in the list's order, so the same source
   * answers whenever it can, however fast the others are. Throws an `AggregateError` of every
   * source's error when none can answer.
   */
  private async firstAnswer<Source extends { name: string }, T>(
    sources: Source[],
    ask: (source: Source) => Promise<T>,
    failure: string,
  ): Promise<{ value: T, source: string }> {
    const answers = sources.map(ask)
    answers.forEach((answer) => answer.catch(() => undefined)) // handled in the loop below
    const errors: unknown[] = []
    for (let i = 0; i < sources.length; i++) {
      try {
        return { value: await answers[i], source: sources[i].name }
      } catch (error) {
        errors.push(error)
      }
    }
    throw new AggregateError(errors, failure)
  }
}
