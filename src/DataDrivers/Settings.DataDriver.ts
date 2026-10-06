import fs from 'fs'
import { ISettingsDataDriver, SettingsDto } from './DataDrivers.type'
import { parseDataFile, SettingsSchema } from './DataFiles.schema'
import { dataFilePath, parseJsonc } from './DataFiles.reader'

export class SettingsDataDriver implements ISettingsDataDriver {
  /** @param dataDir the folder holding the portfolio files */
  constructor(private readonly dataDir: string) {}

  public async getPortfolioSettings(type: string): Promise<SettingsDto> {
    const filePath = dataFilePath(this.dataDir, '_settings', type)

    if (!fs.existsSync(filePath)) {
      throw Error(`Portfolio '${type}' not found: no settings file at '${filePath}'`)
    }

    const jsoncString = fs.readFileSync(filePath).toString()
    return parseDataFile(SettingsSchema, parseJsonc(jsoncString, filePath), filePath)
  }
}
