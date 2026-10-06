import {
  IOverridesDataDriver,
  IPriceDataDriver,
  ISettingsDataDriver,
  OverridesDto,
  SecurityPriceDto,
  SettingsSecurityDto,
} from '#src/DataDrivers/DataDrivers.type'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { IPortfolioSecurity, PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'
import { IPortfolioRepository } from '#src/UseCases/IPortfolioRepository.type'

/** Where the repository reads a portfolio from. */
export interface PortfolioDataDrivers {
  settings: ISettingsDataDriver
  overrides: IOverridesDataDriver
  /** Raced for every price that isn't overridden: the first to answer wins. */
  prices: IPriceDataDriver[]
}

/** Own keys only, so a tick like 'toString' isn't "overridden" by Object.prototype. */
function isOverridden(tick: string, overrides: OverridesDto): boolean {
  return Object.hasOwn(overrides, tick)
}

export class PortfolioRepository implements IPortfolioRepository {
  constructor(private readonly dataDrivers: PortfolioDataDrivers) {}

  public async getPortfolio(type: string): Promise<Portfolio> {
    let portfolio: Portfolio
    try {
      portfolio = await this.loadPortfolio(type)
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

  private async loadPortfolio(type: string): Promise<Portfolio> {
    const { settings, overrides: overridesDD, prices } = this.dataDrivers

    const {
      brokerageFeeFlat, tradingFeePercentage, minimumTradingFeeFlat, securities,
    } = await settings.getPortfolioSettings(type)
    const overrides = await overridesDD.getPortfolioOverrides(type)

    // Only start the browsers when at least one price has to be scraped
    if (securities.some(({ tick }) => !isOverridden(tick, overrides))) {
      for (const priceDD of prices) {
        await priceDD.launchBrowser()
      }
    }

    const PortfolioSecurities: IPortfolioSecurity[] = await Promise.all(
      securities.map(async (security) => {
        const {
          tick, isin, shares, targetPercentage, exchange,
        } = security
        const { price, currency } = await this.getPrice(security, overrides)
        return {
          tick,
          isin,
          price,
          shares,
          targetPercentage,
          exchange,
          currency,
          brokerageFeeFlat,
          tradingFeePercentage,
          minimumTradingFeeFlat,
        } as IPortfolioSecurity
      }),
    )

    return new Portfolio({
      securities: PortfolioSecurities.map((s) => new PortfolioSecurity(s)),
    })
  }

  private async getPrice(
    setting: SettingsSecurityDto,
    overrides: OverridesDto,
  ): Promise<SecurityPriceDto> {
    if (isOverridden(setting.tick, overrides)) return overrides[setting.tick]

    return Promise.any(this.dataDrivers.prices.map((priceDD) => priceDD.getPrice(setting)))
  }
}
