import { IOverridesDataDriver, OverridesDto } from './DataDrivers.type'
import { OverridesSchema } from './DataFiles.schema'
import { portfolioFiles, readOptionalDataFile } from './DataFiles.reader'

export class OverridesDataDriver implements IOverridesDataDriver {
  /** @param dataDir the folder holding a folder per broker */
  constructor(private readonly dataDir: string) {}

  public async getPortfolioOverrides(portfolioId: string): Promise<OverridesDto> {
    const { overrides } = portfolioFiles(this.dataDir, portfolioId)
    // A missing, empty or comments-only file means no overrides
    return readOptionalDataFile(OverridesSchema, overrides) ?? {}
  }
}
