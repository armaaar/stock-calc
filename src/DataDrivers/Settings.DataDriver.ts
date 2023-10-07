import { parse } from 'jsonc-parser'
import { assert } from 'typia'
import fs from 'fs'
import { SettingsDto } from './IPriceDataDriver.type'

export class SettingsDataDriver {
  public async getPortfolioSettings(type: string): Promise<SettingsDto[]> {
    const jsoncString = fs
      .readFileSync(`${__dirname}/../data/_settings.${type}.jsonc`)
      .toString()
    const settingsModule = parse(jsoncString)
    const settings = assert<SettingsDto[]>(settingsModule)
    return settings
  }
}
