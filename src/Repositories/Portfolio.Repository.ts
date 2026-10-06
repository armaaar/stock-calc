import { IPriceDataDriver, SecurityPriceDto, SettingsSecurityDto } from '@/DataDrivers/IPriceDataDriver.type'
import { JustEtfDataDriver } from '@/DataDrivers/JustEtf.DataDriver'
import { OverridesDataDriver } from '@/DataDrivers/Overrides.DataDriver'
import { SettingsDataDriver } from '@/DataDrivers/Settings.DataDriver'
import { TradingViewDataDriver } from '@/DataDrivers/TradingView.DataDriver'
import { Portfolio } from '@/Entities/Portfolio.Entity'
import { IPortfolioSecurity, PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity'

type Overrides = Record<string, SecurityPriceDto>

/** Own keys only, so a tick like 'toString' isn't "overridden" by Object.prototype. */
function isOverridden(tick: string, overrides: Overrides): boolean {
  return Object.hasOwn(overrides, tick)
}

export class PortfolioRepository {
  private justEtfDD = new JustEtfDataDriver()

  private tradingViewDD = new TradingViewDataDriver()

  private settingsDD = new SettingsDataDriver()

  private overridesDD = new OverridesDataDriver()

  public async getPortfolio(type: string): Promise<Portfolio> {
    try {
      const {
        brokerageFeeFlat, tradingFeePercentage, minimumTradingFeeFlat, securities,
      } = await this.settingsDD.getPortfolioSettings(type)
      const overrides = await this.overridesDD.getPortfolioOverrides(type)

      // Only start the browsers when at least one price has to be scraped
      if (securities.some(({ tick }) => !isOverridden(tick, overrides))) {
        await this.justEtfDD.launchBrowser()
        await this.tradingViewDD.launchBrowser()
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
    } finally {
      // Closing a browser that was never launched is a no-op
      await Promise.all([
        this.justEtfDD.closeBrowser(),
        this.tradingViewDD.closeBrowser(),
      ])
    }
  }

  private async getPrice(
    setting: SettingsSecurityDto,
    overrides: Overrides,
  ): Promise<SecurityPriceDto> {
    if (isOverridden(setting.tick, overrides)) return overrides[setting.tick]

    const priceDataDrivers: IPriceDataDriver[] = [
      this.justEtfDD,
      this.tradingViewDD,
    ]

    const prices: Promise<SecurityPriceDto>[] = []

    for (let i = 0; i < priceDataDrivers.length; i++) {
      prices.push(priceDataDrivers[i].getPrice(setting))
    }

    return Promise.any(prices)
  }
}
