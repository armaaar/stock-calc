import fs from 'fs'
import path from 'path'
import {
  afterEach, describe, expect, it, vi,
} from 'vitest'
import {
  createDataDir, EUR_SETTINGS, EUR_SETTINGS_JSONC,
} from '#src/__fixtures__/dataFiles'
import { SettingsDataDriver } from '../Settings.DataDriver'

describe('SettingsDataDriver', () => {
  let dataDir: string

  /** A driver over a fresh data folder holding only `_settings.<type>.jsonc` (if given). */
  function givenFile(content: string | undefined, type = 'EUR') {
    dataDir = createDataDir(content === undefined ? {} : { [`_settings.${type}.jsonc`]: content })
    return new SettingsDataDriver(dataDir)
  }

  const settingsPath = (type: string) => path.join(dataDir, `_settings.${type}.jsonc`)

  async function errorOf(promise: Promise<unknown>): Promise<Error> {
    const error = await promise.then(() => undefined, (e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    return error as Error
  }

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it('reads <dataDir>/_settings.<TYPE>.jsonc', async () => {
    const driver = givenFile(EUR_SETTINGS_JSONC, 'EGP')
    const existsSync = vi.spyOn(fs, 'existsSync')
    const readFileSync = vi.spyOn(fs, 'readFileSync')

    await expect(driver.getPortfolioSettings('EGP')).resolves.toEqual(EUR_SETTINGS)

    expect(existsSync).toHaveBeenCalledWith(settingsPath('EGP'))
    expect(readFileSync).toHaveBeenCalledWith(settingsPath('EGP'))
  })

  it('returns the parsed settings, accepting JSONC comments', async () => {
    const driver = givenFile(EUR_SETTINGS_JSONC)

    await expect(driver.getPortfolioSettings('EUR')).resolves.toEqual(EUR_SETTINGS)
  })

  it('does not read a settings file from another portfolio', async () => {
    const driver = givenFile(EUR_SETTINGS_JSONC, 'EUR')

    await expect(driver.getPortfolioSettings('EGP')).rejects.toThrow(/^Portfolio 'EGP' not found/)
  })

  it('throws "Portfolio \'X\' not found" when the settings file is missing', async () => {
    const driver = givenFile(undefined)
    const readFileSync = vi.spyOn(fs, 'readFileSync')

    const error = await errorOf(driver.getPortfolioSettings('XYZ'))

    expect(error.message)
      .toBe(`Portfolio 'XYZ' not found: no settings file at '${settingsPath('XYZ')}'`)
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it('throws an "Invalid data file" error with the field path for an invalid shape', async () => {
    const driver = givenFile('{ "brokerageFeeFlat": 1, "tradingFeePercentage": 0, '
      + '"minimumTradingFeeFlat": 0, "securities": [{ "tick": "QDVE", "exchange": "IBIS2", '
      + '"shares": "100", "targetPercentage": 1 }] }')

    const error = await errorOf(driver.getPortfolioSettings('EUR'))

    expect(error.message.startsWith(`Invalid data file '${settingsPath('EUR')}':`)).toBe(true)
    expect(error.message).toContain('securities[0].shares')
  })

  it('throws "Invalid data file" for an empty file', async () => {
    const driver = givenFile('')

    await expect(driver.getPortfolioSettings('EUR')).rejects.toThrow(
      `Invalid data file '${settingsPath('EUR')}': JSONC syntax error: ValueExpected at 1:1`,
    )
  })

  it('reports JSONC syntax errors with the code and line:column instead of recovering', async () => {
    const driver = givenFile(
      EUR_SETTINGS_JSONC.replace('"brokerageFeeFlat": 1,', '"brokerageFeeFlat": 1,,'),
    )

    const error = await errorOf(driver.getPortfolioSettings('EUR'))

    expect(error.message.startsWith(
      `Invalid data file '${settingsPath('EUR')}': `
      + 'JSONC syntax error: PropertyNameExpected at 3:25',
    )).toBe(true)
  })

  it('accepts trailing commas', async () => {
    const driver = givenFile(
      EUR_SETTINGS_JSONC.replace('"targetPercentage": 0.6 }', '"targetPercentage": 0.6, },'),
    )

    await expect(driver.getPortfolioSettings('EUR')).resolves.toEqual(EUR_SETTINGS)
  })

  it('reports out-of-range values with the file and field path', async () => {
    const driver = givenFile(EUR_SETTINGS_JSONC.replace('"shares": 100', '"shares": -1'))

    const error = await errorOf(driver.getPortfolioSettings('EUR'))

    expect(error.message.startsWith(`Invalid data file '${settingsPath('EUR')}':\n`)).toBe(true)
    expect(error.message).toContain('securities[0].shares')
  })

  it.each(['../../../x', 'EUR/../EGP', 'a b', ''])(
    'rejects the portfolio name %j before touching the file system',
    async (type) => {
      const driver = givenFile(undefined)
      const existsSync = vi.spyOn(fs, 'existsSync')
      const readFileSync = vi.spyOn(fs, 'readFileSync')

      await expect(driver.getPortfolioSettings(type)).rejects.toThrow(
        `Invalid portfolio name '${type}': use letters, digits, '_' or '-'`,
      )
      expect(existsSync).not.toHaveBeenCalled()
      expect(readFileSync).not.toHaveBeenCalled()
    },
  )

  it('rejects a name that would resolve to an existing file outside the settings files', async () => {
    // 'EUR/../EGP' would resolve to <dataDir>/EGP.jsonc
    dataDir = createDataDir({ 'EGP.jsonc': EUR_SETTINGS_JSONC })
    const driver = new SettingsDataDriver(dataDir)

    await expect(driver.getPortfolioSettings('EUR/../EGP')).rejects.toThrow(/^Invalid portfolio name/)
  })
})
