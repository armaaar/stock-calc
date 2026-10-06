import {
  IOverridesDataDriver,
  IPriceDataDriver,
  ISettingsDataDriver,
  OverridesDto,
  SettingsSecurityDto,
} from '#src/DataDrivers/DataDrivers.type'
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
}

/** A price with where and when it was quoted, ready for the domain's `PriceQuote`. */
type SourcedPrice = Pick<IPortfolioSecurity, 'price' | 'currency' | 'priceSource' | 'pricedAt'>

export const OVERRIDE_SOURCE = 'override'

/** Own keys only, so a tick like 'toString' isn't "overridden" by Object.prototype. */
function isOverridden(tick: string, overrides: OverridesDto): boolean {
  return Object.hasOwn(overrides, tick)
}

export class PortfolioRepository implements IPortfolioRepository {
  /** @param now the clock that time-stamps live prices */
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

  /** Closing a browser that was never launched is a no-op. */
  private closeBrowsers(): Promise<void>[] {
    return this.dataDrivers.prices.map((priceDD) => priceDD.closeBrowser())
  }

  private async loadPortfolio(requestedId?: string): Promise<Portfolio> {
    const { settings, overrides: overridesDD, prices } = this.dataDrivers

    const portfolioId = await settings.resolvePortfolioId(requestedId)
    const {
      brokerageFeeFlat, tradingFeePercentage, minimumTradingFeeFlat, cash, feeWarningPercentage,
      securities,
    } = await settings.getPortfolioSettings(portfolioId)
    const overrides = await overridesDD.getPortfolioOverrides(portfolioId)

    // Only start the browsers when at least one price has to be scraped. They start together,
    // so a cold start costs the slowest launch, not the sum. If one fails, closing them waits
    // for any launch still in flight (BrowserController), so nothing is left running.
    if (securities.some(({ tick }) => !isOverridden(tick, overrides))) {
      await Promise.all(prices.map((priceDD) => priceDD.launchBrowser()))
    }

    const PortfolioSecurities: IPortfolioSecurity[] = await Promise.all(
      securities.map(async (security) => {
        const {
          tick, isin, shares, targetPercentage, exchange,
        } = security
        return {
          tick,
          isin,
          ...await this.getPrice(security, overrides),
          shares,
          targetPercentage,
          exchange,
          // A fee part the security doesn't set falls back to the portfolio's, part by part
          brokerageFeeFlat: security.brokerageFeeFlat ?? brokerageFeeFlat,
          tradingFeePercentage: security.tradingFeePercentage ?? tradingFeePercentage,
          minimumTradingFeeFlat: security.minimumTradingFeeFlat ?? minimumTradingFeeFlat,
        } as IPortfolioSecurity
      }),
    )

    return new Portfolio({
      securities: PortfolioSecurities.map((s) => new PortfolioSecurity(s)),
      cash,
      feeWarningPercentage,
    })
  }

  private async getPrice(
    setting: SettingsSecurityDto,
    overrides: OverridesDto,
  ): Promise<SourcedPrice> {
    if (isOverridden(setting.tick, overrides)) {
      const { price, currency, asOf } = overrides[setting.tick]
      return {
        price,
        currency,
        priceSource: OVERRIDE_SOURCE,
        // A date: the time of day of a hand-entered price isn't known
        pricedAt: asOf,
      }
    }

    const { prices } = this.dataDrivers
    // An empty AggregateError would name no security
    if (prices.length === 0) {
      throw Error(`No price source for '${setting.tick}': add its price to the overrides`)
    }

    // Ask every source at once, but take the answers in the list's order, so the same source
    // prices a security whenever it can, however fast the others are
    const answers = prices.map((priceDD) => priceDD.getPrice(setting))
    answers.forEach((answer) => answer.catch(() => undefined)) // handled in the loop below
    const errors: unknown[] = []
    for (let i = 0; i < prices.length; i++) {
      try {
        const { price, currency } = await answers[i]
        return {
          price, currency, priceSource: prices[i].name, pricedAt: this.now().toISOString(),
        }
      } catch (error) {
        errors.push(error)
      }
    }
    throw new AggregateError(errors, `No price source could price '${setting.tick}'`)
  }
}
