import fs from 'fs'
import { SettingsDto } from './IPriceDataDriver.type'
import { parseDataFile, SettingsSchema } from './DataFiles.schema'
import { dataFilePath, parseJsonc } from './DataFiles.reader'

export class SettingsDataDriver {
  public async getPortfolioSettings(type: string): Promise<SettingsDto> {
    const filePath = dataFilePath('_settings', type)

    if (!fs.existsSync(filePath)) {
      throw Error(`Portfolio '${type}' not found: no settings file at '${filePath}'`)
    }

    const jsoncString = fs.readFileSync(filePath).toString()
    return parseDataFile(SettingsSchema, parseJsonc(jsoncString, filePath), filePath)
  }
}
