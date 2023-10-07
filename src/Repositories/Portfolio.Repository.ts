import { JustEtfDataDriver } from '@/DataDrivers/JustEtf.DataDriver'
import { SettingsDataDriver } from '@/DataDrivers/Settings.DataDriver'
import { Portfolio } from '@/Entities/Portfolio.Entity'
import { IPortfolioSecurity, PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity'

export class PortfolioRepository {
  private justEtfDD = new JustEtfDataDriver()

  private settingsDD = new SettingsDataDriver()

  public async getPortfolio(): Promise<Portfolio> {
    const settings = await this.settingsDD.getPortfolioSettings()

    const PortfolioSecurities: IPortfolioSecurity[] = await Promise.all(
      settings.map(async (p) => {
        const {
          tick, isin, shares, targetPercentage, exchange,
        } = p
        const { price, currency } = await this.justEtfDD.getPrice(p)
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
}
