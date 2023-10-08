import { IPriceDataDriver, SecurityPriceDto, SettingsSecurityDto } from '@/DataDrivers/IPriceDataDriver.type'
import { JustEtfDataDriver } from '@/DataDrivers/JustEtf.DataDriver'
import { SettingsDataDriver } from '@/DataDrivers/Settings.DataDriver'
import { TradingViewDataDriver } from '@/DataDrivers/TradingView.DataDriver'
import { Portfolio } from '@/Entities/Portfolio.Entity'
import { IPortfolioSecurity, PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity'

export class PortfolioRepository {
  private justEtfDD = new JustEtfDataDriver()

  private tradingViewDD = new TradingViewDataDriver()

  private settingsDD = new SettingsDataDriver()

  public async getPortfolio(type: string): Promise<Portfolio> {
    try {
      const {
        brokerageFeeFlat, tradingFeePercentage, minimumTradingFeeFlat, securities,
      } = await this.settingsDD.getPortfolioSettings(type)

      await this.justEtfDD.launchBrowser()
      await this.tradingViewDD.launchBrowser()

      const PortfolioSecurities: IPortfolioSecurity[] = await Promise.all(
        securities.map(async (security) => {
          const {
            tick, isin, shares, targetPercentage, exchange,
          } = security
          const { price, currency } = await this.getPrice(security)
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
      this.justEtfDD.closeBrowser()
      this.tradingViewDD.closeBrowser()
    }
  }

  private async getPrice(setting: SettingsSecurityDto): Promise<SecurityPriceDto> {
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
