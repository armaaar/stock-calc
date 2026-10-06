import fs from 'fs'
import { IOverridesDataDriver, OverridesDto } from './DataDrivers.type'
import { OverridesSchema, parseDataFile } from './DataFiles.schema'
import { dataFilePath, isBlankJsonc, parseJsonc } from './DataFiles.reader'

export class OverridesDataDriver implements IOverridesDataDriver {
  /** @param dataDir the folder holding the portfolio files */
  constructor(private readonly dataDir: string) {}

  public async getPortfolioOverrides(type: string): Promise<OverridesDto> {
    const filePath = dataFilePath(this.dataDir, '_overrides', type)

    if (!fs.existsSync(filePath)) return {}

    const jsoncString = fs.readFileSync(filePath).toString()
    // An empty (or comments-only) file means no overrides, just like a missing one
    if (isBlankJsonc(jsoncString)) return {}

    return parseDataFile(OverridesSchema, parseJsonc(jsoncString, filePath), filePath)
  }
}
