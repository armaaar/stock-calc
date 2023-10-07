import { IPriceDataDriver, SecurityPriceDto, SettingsDto } from '@/DataDrivers/IPriceDataDriver.type'
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
    const settings = await this.settingsDD.getPortfolioSettings(type)

    const PortfolioSecurities: IPortfolioSecurity[] = await Promise.all(
      settings.map(async (setting) => {
        const {
          tick, isin, shares, targetPercentage, exchange,
        } = setting
        const { price, currency } = await this.getPrice(setting)
        return {
          tick,
          isin,
          price,
          shares,
          targetPercentage,
          exchange,
          currency,
        } as IPortfolioSecurity
      }),
    )

    return new Portfolio(PortfolioSecurities.map((s) => new PortfolioSecurity(s)))
  }

  private async getPrice(setting: SettingsDto): Promise<SecurityPriceDto> {
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
