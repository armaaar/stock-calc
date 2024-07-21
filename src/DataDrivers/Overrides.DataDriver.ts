import { parse } from 'jsonc-parser'
import { assert } from 'typia'
import fs from 'fs'
import { SecurityPriceDto } from './IPriceDataDriver.type'

export class OverridesDataDriver {
  public async getPortfolioOverrides(type: string): Promise<Record<string, SecurityPriceDto>> {
    const filePath = `${__dirname}/../data/_overrides.${type}.jsonc`

    if (!fs.existsSync(filePath)) return {}

    const jsoncString = fs.readFileSync(filePath).toString()
    const overridesModule = parse(jsoncString)
    const overrides = assert<Record<string, SecurityPriceDto>>(overridesModule)
    return overrides
  }
}
