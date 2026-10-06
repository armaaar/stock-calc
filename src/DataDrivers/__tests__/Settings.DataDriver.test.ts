import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { EUR_SETTINGS, EUR_SETTINGS_JSONC } from '@/__fixtures__/dataFiles'
import { SettingsDataDriver } from '.././Settings.DataDriver'

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn<(p: string) => boolean>(),
  readFileSync: vi.fn<(p: string) => Buffer>(),
}))

vi.mock('fs', () => ({ default: fsMock }))

const toPosix = (p: string) => p.replace(/\\/g, '/')

function givenFile(content: string | undefined) {
  fsMock.existsSync.mockReturnValue(content !== undefined)
  fsMock.readFileSync.mockReturnValue(Buffer.from(content ?? ''))
}

describe('SettingsDataDriver', () => {
  const driver = new SettingsDataDriver()

  beforeEach(() => {
    fsMock.existsSync.mockReset()
    fsMock.readFileSync.mockReset()
  })

  it('reads src/data/_settings.<TYPE>.jsonc', async () => {
    givenFile(EUR_SETTINGS_JSONC)

    await driver.getPortfolioSettings('EUR')

    const checkedPath = toPosix(fsMock.existsSync.mock.calls[0][0])
    expect(checkedPath).toMatch(/\/src\/data\/_settings\.EUR\.jsonc$/)
    expect(fsMock.readFileSync).toHaveBeenCalledWith(fsMock.existsSync.mock.calls[0][0])
  })

  it('returns the parsed settings, accepting JSONC comments', async () => {
    givenFile(EUR_SETTINGS_JSONC)

    await expect(driver.getPortfolioSettings('EUR')).resolves.toEqual(EUR_SETTINGS)
  })

  it('throws "Portfolio \'X\' not found" when the settings file is missing', async () => {
    givenFile(undefined)

    await expect(driver.getPortfolioSettings('XYZ'))
      .rejects.toThrow(/^Portfolio 'XYZ' not found: no settings file at '.*_settings\.XYZ\.jsonc'$/)
    expect(fsMock.readFileSync).not.toHaveBeenCalled()
  })

  it('throws an "Invalid data file" error with the field path for an invalid shape', async () => {
    givenFile('{ "brokerageFeeFlat": 1, "tradingFeePercentage": 0, "minimumTradingFeeFlat": 0, '
      + '"securities": [{ "tick": "QDVE", "exchange": "IBIS2", "shares": "100", '
      + '"targetPercentage": 1 }] }')

    const error = await driver.getPortfolioSettings('EUR').catch((e: Error) => e)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/^Invalid data file '.*_settings\.EUR\.jsonc':/)
    expect((error as Error).message).toContain('securities[0].shares')
  })

  it('throws "Invalid data file" for an empty file', async () => {
    givenFile('')

    await expect(driver.getPortfolioSettings('EUR')).rejects.toThrow(/Invalid data file/)
  })

  // Current behaviour: jsonc-parser is lenient and its parse errors are ignored, so a
  // syntactically broken file is accepted as long as what it could recover matches the schema.
  it('silently tolerates JSON syntax errors', async () => {
    givenFile(EUR_SETTINGS_JSONC.replace('"brokerageFeeFlat": 1,', '"brokerageFeeFlat": 1,,'))

    await expect(driver.getPortfolioSettings('EUR')).resolves.toEqual(EUR_SETTINGS)
  })

  // Current behaviour: the portfolio type is interpolated into the path unsanitised, so it can
  // point outside src/data.
  it('does not sanitise the portfolio type', async () => {
    givenFile(undefined)

    await driver.getPortfolioSettings('../../../x').catch(() => undefined)

    // '_settings.../../../x.jsonc' resolves to src/x.jsonc
    expect(toPosix(fsMock.existsSync.mock.calls[0][0])).toMatch(/\/src\/x\.jsonc$/)
  })
})
