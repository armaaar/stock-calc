import { JustEtfDataDriver } from '@/DataDrivers/JustEtf.DataDriver';
import { SettingsDataDriver } from '@/DataDrivers/Settings.DataDriver';
import { Portfolio } from '@/Entities/Portfolio.Entity';
import { PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity';

export class PortfolioRepository {
  private justEtfDD = new JustEtfDataDriver();

  private settingsDD = new SettingsDataDriver();

  public async getPortfolio(): Promise<Portfolio> {
    const settings = await this.settingsDD.getPortfolio();
    const prices = await this.justEtfDD.getPrices(settings.map((p) => p.isin));

    return new Portfolio(
      settings.map((p) => new PortfolioSecurity({
        tick: p.tick,
        isin: p.isin,
        price: prices[p.isin].price,
        shares: p.shares,
        targetPercentage: p.targetPercentage,
        exchange: p.exchange,
        currency: prices[p.isin].currency,
      })),
    );
  }
}
