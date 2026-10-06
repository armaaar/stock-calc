import fs from 'fs'
import { SecurityPriceDto } from './IPriceDataDriver.type'
import { OverridesSchema, parseDataFile } from './DataFiles.schema'
import { dataFilePath, isBlankJsonc, parseJsonc } from './DataFiles.reader'

export class OverridesDataDriver {
  public async getPortfolioOverrides(type: string): Promise<Record<string, SecurityPriceDto>> {
    const filePath = dataFilePath('_overrides', type)

    if (!fs.existsSync(filePath)) return {}

    const jsoncString = fs.readFileSync(filePath).toString()
    // An empty (or comments-only) file means no overrides, just like a missing one
    if (isBlankJsonc(jsoncString)) return {}

    return parseDataFile(OverridesSchema, parseJsonc(jsoncString, filePath), filePath)
  }
}
