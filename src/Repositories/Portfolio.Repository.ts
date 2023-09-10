import { JustEtf_DataDriver } from "@/DataDrivers/JustEtf.DataDriver"
import { Settings_DataDriver } from "@/DataDrivers/Settings.DataDriver"
import { Portfolio } from "@/Entities/Portfolio.Entity"
import { PortfolioSecurity } from "@/Entities/PortfolioSecurity.Entity"

export class Portfolio_Repository {

    private _justEtfDD  = new JustEtf_DataDriver()
    private _settingsDD = new Settings_DataDriver()

    public async getPortfolio(): Promise<Portfolio> {
        const settings = await this._settingsDD.getPortfolio()
        const prices = await this._justEtfDD.getPrices(settings.map((p) => p.isin))

        return new Portfolio(
            settings.map((p) => new PortfolioSecurity({
                tick: p.tick,
                isin: p.isin,
                price: prices[p.isin].price,
                shares: p.shares,
                targetPercentage: p.targetPercentage,
                exchange: p.exchange,
                currency: prices[p.isin].currency,
            }))
        )
    }
}