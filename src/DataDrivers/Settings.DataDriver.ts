import { assert } from 'typia'
import { SettingsDto } from './IPriceDataDriver.type'

export class SettingsDataDriver {
  public async getPortfolioSettings(type: string): Promise<SettingsDto[]> {
    const settingsModule = await import(`./data/_settings.${type}.json`)
    const settings = assert<SettingsDto[]>(settingsModule.default)
    return settings
  }
}
