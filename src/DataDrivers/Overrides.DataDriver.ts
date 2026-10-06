import { parse } from 'jsonc-parser'
import fs from 'fs'
import path from 'path'
import { SecurityPriceDto } from './IPriceDataDriver.type'
import { OverridesSchema, parseDataFile } from './DataFiles.schema'

export class OverridesDataDriver {
  public async getPortfolioOverrides(type: string): Promise<Record<string, SecurityPriceDto>> {
    const filePath = path.resolve(import.meta.dirname, '../data', `_overrides.${type}.jsonc`)

    if (!fs.existsSync(filePath)) return {}

    const jsoncString = fs.readFileSync(filePath).toString()
    return parseDataFile(OverridesSchema, parse(jsoncString), filePath)
  }
}
