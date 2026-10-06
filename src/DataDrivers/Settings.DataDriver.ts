import fs from 'fs'
import { ISettingsDataDriver, SettingsDto } from './DataDrivers.type'
import { BrokerSchema, parseDataFile, SettingsSchema } from './DataFiles.schema'
import {
  assertPortfolioId, hasLegacyPortfolioFiles, listPortfolioIds, parseJsonc, portfolioFiles,
  readOptionalDataFile,
} from './DataFiles.reader'

export class SettingsDataDriver implements ISettingsDataDriver {
  /** @param dataDir the folder holding a folder per broker */
  constructor(private readonly dataDir: string) {}

  public async resolvePortfolioId(requested?: string): Promise<string> {
    if (requested !== undefined) {
      assertPortfolioId(requested)
      if (fs.existsSync(portfolioFiles(this.dataDir, requested).settings)) return requested
    }

    const found = listPortfolioIds(this.dataDir)
    if (requested === undefined && found.length === 1) return found[0]

    const problem = requested !== undefined
      ? `Portfolio '${requested}' not found in '${this.dataDir}'.`
      : found.length === 0
        ? `No portfolio found in '${this.dataDir}'.`
        : 'Choose a portfolio.'
    throw Error(`${problem} ${this.portfoliosHint(found)}`)
  }

  public async getPortfolioSettings(portfolioId: string): Promise<SettingsDto> {
    const files = portfolioFiles(this.dataDir, await this.resolvePortfolioId(portfolioId))

    const text = fs.readFileSync(files.settings).toString()
    const settings = parseDataFile(SettingsSchema, parseJsonc(text, files.settings), files.settings)
    const broker = readOptionalDataFile(BrokerSchema, files.broker) ?? {}

    // Optional keys a file leaves out are absent, so the portfolio's own values win
    return { ...broker, ...settings }
  }

  /** What there is to choose from, or how to add a portfolio. */
  private portfoliosHint(found: string[]): string {
    if (found.length > 0) return `Portfolios: ${found.join(', ')}`

    const add = 'Add one as <broker>/<portfolio>.jsonc, for example ibkr/eur.jsonc'
    if (!hasLegacyPortfolioFiles(this.dataDir)) return add
    return `${add}. Portfolio files now live in a folder per broker: move _settings.<name>.jsonc`
      + ' to <broker>/<name>.jsonc and _overrides.<name>.jsonc to <broker>/<name>.overrides.jsonc'
  }
}
