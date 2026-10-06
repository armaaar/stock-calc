import { parse } from 'jsonc-parser'
import fs from 'fs'
import path from 'path'
import { SettingsDto } from './IPriceDataDriver.type'
import { parseDataFile, SettingsSchema } from './DataFiles.schema'

export class SettingsDataDriver {
  public async getPortfolioSettings(type: string): Promise<SettingsDto> {
    const filePath = path.resolve(import.meta.dirname, '../data', `_settings.${type}.jsonc`)

    if (!fs.existsSync(filePath)) {
      throw Error(`Portfolio '${type}' not found: no settings file at '${filePath}'`)
    }

    const jsoncString = fs.readFileSync(filePath).toString()
    return parseDataFile(SettingsSchema, parse(jsoncString), filePath)
  }
}
