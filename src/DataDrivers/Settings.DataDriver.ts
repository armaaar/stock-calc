import settings from './data/_settings.json'
import { SettingsDto } from './IPriceDataDriver.type'

export class SettingsDataDriver {
  public async getPortfolioSettings(): Promise<SettingsDto[]> {
    return settings
  }
}
