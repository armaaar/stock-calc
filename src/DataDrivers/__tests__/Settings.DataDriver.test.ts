import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { EUR_SETTINGS, EUR_SETTINGS_JSONC } from '#src/__fixtures__/dataFiles'
import { SettingsDataDriver } from '../Settings.DataDriver'

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

  it('reports JSONC syntax errors with the code and line:column instead of recovering', async () => {
    givenFile(EUR_SETTINGS_JSONC.replace('"brokerageFeeFlat": 1,', '"brokerageFeeFlat": 1,,'))

    await expect(driver.getPortfolioSettings('EUR')).rejects.toThrow(
      /^Invalid data file '.*_settings\.EUR\.jsonc': JSONC syntax error: PropertyNameExpected at 3:25/,
    )
  })

  it('accepts trailing commas', async () => {
    givenFile(EUR_SETTINGS_JSONC.replace('"targetPercentage": 0.6 }', '"targetPercentage": 0.6, },'))

    await expect(driver.getPortfolioSettings('EUR')).resolves.toEqual(EUR_SETTINGS)
  })

  it('reports out-of-range values with the file and field path', async () => {
    givenFile(EUR_SETTINGS_JSONC.replace('"shares": 100', '"shares": -1'))

    const error = await driver.getPortfolioSettings('EUR').catch((e: Error) => e)

    expect((error as Error).message).toMatch(/^Invalid data file '.*_settings\.EUR\.jsonc':\n/)
    expect((error as Error).message).toContain('securities[0].shares')
  })

  it.each(['../../../x', 'EUR/../EGP', 'a b', ''])(
    'rejects the portfolio name %j before touching the file system',
    async (type) => {
      await expect(driver.getPortfolioSettings(type)).rejects.toThrow(
        `Invalid portfolio name '${type}': use letters, digits, '_' or '-'`,
      )
      expect(fsMock.existsSync).not.toHaveBeenCalled()
      expect(fsMock.readFileSync).not.toHaveBeenCalled()
    },
  )
})
