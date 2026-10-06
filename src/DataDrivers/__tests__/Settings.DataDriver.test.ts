import fs from 'fs'
import path from 'path'
import {
  afterEach, describe, expect, it, vi,
} from 'vitest'
import {
  createDataDir, EUR_SETTINGS, EUR_SETTINGS_JSONC,
} from '#src/__fixtures__/dataFiles'
import type { SettingsDto } from '../DataDrivers.type'
import { SettingsDataDriver } from '../Settings.DataDriver'

describe('SettingsDataDriver', () => {
  let dataDir: string

  /** A driver over a fresh data folder holding the given files (path → content). */
  function givenFiles(files: Record<string, string> = {}) {
    dataDir = createDataDir(files)
    return new SettingsDataDriver(dataDir)
  }

  /** A driver over a data folder holding only `<id>.jsonc` (if given). */
  function givenFile(content: string | undefined, id = 'ibkr/eur') {
    return givenFiles(content === undefined ? {} : { [`${id}.jsonc`]: content })
  }

  const settingsPath = (id: string) => path.join(dataDir, `${id}.jsonc`)

  async function errorOf(promise: Promise<unknown>): Promise<Error> {
    const error = await promise.then(() => undefined, (e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    return error as Error
  }

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  describe('resolvePortfolioId', () => {
    it('returns a requested portfolio that exists', async () => {
      const driver = givenFiles({ 'ibkr/eur.jsonc': '{}', 'thndr/egp.jsonc': '{}' })

      await expect(driver.resolvePortfolioId('thndr/egp')).resolves.toBe('thndr/egp')
    })

    it('returns the only portfolio when none is requested', async () => {
      const driver = givenFiles({ 'ibkr/eur.jsonc': '{}', 'ibkr/_broker.jsonc': '{}' })

      await expect(driver.resolvePortfolioId()).resolves.toBe('ibkr/eur')
    })

    it('asks to choose, listing the portfolios, when none is requested and there are several', async () => {
      const driver = givenFiles({ 'thndr/egp.jsonc': '{}', 'ibkr/eur.jsonc': '{}' })

      await expect(driver.resolvePortfolioId())
        .rejects.toThrow('Choose a portfolio. Portfolios: ibkr/eur, thndr/egp')
    })

    it('says a requested portfolio was not found, listing the ones there are', async () => {
      const driver = givenFiles({ 'ibkr/eur.jsonc': '{}' })

      await expect(driver.resolvePortfolioId('ibkr/growth')).rejects.toThrow(
        `Portfolio 'ibkr/growth' not found in '${dataDir}'. Portfolios: ibkr/eur`,
      )
    })

    it('explains how to add a portfolio when there are none', async () => {
      const driver = givenFiles()

      await expect(driver.resolvePortfolioId()).rejects.toThrow(
        `No portfolio found in '${dataDir}'. `
        + 'Add one as <broker>/<portfolio>.jsonc, for example ibkr/eur.jsonc',
      )
      await expect(driver.resolvePortfolioId('ibkr/eur')).rejects.toThrow(
        `Portfolio 'ibkr/eur' not found in '${dataDir}'. Add one as`,
      )
    })

    it('explains how to move files from before broker folders', async () => {
      const driver = givenFiles({ '_settings.EUR.jsonc': '{}' })

      const error = await errorOf(driver.resolvePortfolioId())

      expect(error.message).toBe(
        `No portfolio found in '${dataDir}'. `
        + 'Add one as <broker>/<portfolio>.jsonc, for example ibkr/eur.jsonc. '
        + 'Portfolio files now live in a folder per broker: move _settings.<name>.jsonc to '
        + '<broker>/<name>.jsonc and _overrides.<name>.jsonc to <broker>/<name>.overrides.jsonc',
      )
    })

    it.each(['../../x', 'ibkr/../eur', 'ibkr/_broker', 'EUR', ''])(
      'rejects the portfolio id %j before touching the file system',
      async (id) => {
        const driver = givenFile(undefined)
        const statSync = vi.spyOn(fs, 'statSync')
        const existsSync = vi.spyOn(fs, 'existsSync')
        const readdirSync = vi.spyOn(fs, 'readdirSync')

        await expect(driver.resolvePortfolioId(id)).rejects.toThrow(`Invalid portfolio '${id}'`)
        expect(statSync).not.toHaveBeenCalled()
        expect(existsSync).not.toHaveBeenCalled()
        expect(readdirSync).not.toHaveBeenCalled()
      },
    )

    it('explains how to move old files even when there are portfolios to choose from', async () => {
      const driver = givenFiles({ '_settings.EUR.jsonc': '{}', 'ibkr/growth.jsonc': '{}' })

      await expect(driver.resolvePortfolioId('ibkr/eur')).rejects.toThrow(
        `Portfolio 'ibkr/eur' not found in '${dataDir}'. Portfolios: ibkr/growth. `
        + 'Portfolio files now live in a folder per broker: move _settings.<name>.jsonc to',
      )
    })

    it('does not take a folder named like a portfolio file for a portfolio', async () => {
      const driver = givenFiles({ 'ibkr/eur.jsonc/notes.txt': '' })

      await expect(driver.resolvePortfolioId('ibkr/eur'))
        .rejects.toThrow(`Portfolio 'ibkr/eur' not found in '${dataDir}'.`)
    })

    it('does not take the broker file for a portfolio', async () => {
      const driver = givenFiles({ 'ibkr/_broker.jsonc': '{}' })

      await expect(driver.resolvePortfolioId()).rejects.toThrow(/^No portfolio found/)
    })
  })

  describe('getPortfolioSettings', () => {
    it('reads <dataDir>/<broker>/<portfolio>.jsonc', async () => {
      const driver = givenFile(EUR_SETTINGS_JSONC, 'thndr/egp')
      const readFileSync = vi.spyOn(fs, 'readFileSync')

      await expect(driver.getPortfolioSettings('thndr/egp')).resolves.toEqual(EUR_SETTINGS)

      expect(readFileSync).toHaveBeenCalledWith(settingsPath('thndr/egp'))
    })

    it('returns the parsed settings, accepting JSONC comments', async () => {
      const driver = givenFile(EUR_SETTINGS_JSONC)

      await expect(driver.getPortfolioSettings('ibkr/eur')).resolves.toEqual(EUR_SETTINGS)
    })

    it('takes what the portfolio doesn\'t set from its broker\'s file', async () => {
      const driver = givenFiles({
        'ibkr/_broker.jsonc': `{
          // Shared by every IBKR portfolio
          "brokerageFeeFlat": 3,
          "tradingFeePercentage": 0.001,
          "feeWarningPercentage": 0.02
        }`,
        'ibkr/eur.jsonc': '{ "brokerageFeeFlat": 1, "securities": [] }',
      })

      await expect(driver.getPortfolioSettings('ibkr/eur')).resolves.toEqual({
        brokerageFeeFlat: 1,
        tradingFeePercentage: 0.001,
        feeWarningPercentage: 0.02,
        securities: [],
      } satisfies SettingsDto)
    })

    it('does not use another broker\'s file', async () => {
      const driver = givenFiles({
        'thndr/_broker.jsonc': '{ "brokerageFeeFlat": 3 }',
        'ibkr/eur.jsonc': '{ "securities": [] }',
      })

      await expect(driver.getPortfolioSettings('ibkr/eur')).resolves.toEqual({ securities: [] })
    })

    it.each([
      ['empty', ''],
      ['comments-only', '// nothing shared yet'],
    ])('accepts an %s broker file', async (_, content) => {
      const driver = givenFiles({
        'ibkr/_broker.jsonc': content,
        'ibkr/eur.jsonc': '{ "securities": [] }',
      })

      await expect(driver.getPortfolioSettings('ibkr/eur')).resolves.toEqual({ securities: [] })
    })

    it('rejects an unknown key in the broker file', async () => {
      const driver = givenFiles({
        'ibkr/_broker.jsonc': '{ "brokerageFee": 3 }',
        'ibkr/eur.jsonc': '{ "securities": [] }',
      })

      const error = await errorOf(driver.getPortfolioSettings('ibkr/eur'))

      const brokerFile = path.join(dataDir, 'ibkr', '_broker.jsonc')
      expect(error.message.startsWith(`Invalid data file '${brokerFile}':`)).toBe(true)
      expect(error.message).toContain('brokerageFee')
    })

    it('says which portfolios there are when the settings file is missing', async () => {
      const driver = givenFile(EUR_SETTINGS_JSONC, 'ibkr/eur')
      const readFileSync = vi.spyOn(fs, 'readFileSync')

      await expect(driver.getPortfolioSettings('thndr/egp')).rejects.toThrow(
        `Portfolio 'thndr/egp' not found in '${dataDir}'. Portfolios: ibkr/eur`,
      )
      expect(readFileSync).not.toHaveBeenCalled()
    })

    it('throws an "Invalid data file" error with the field path for an invalid shape', async () => {
      const driver = givenFile('{ "brokerageFeeFlat": 1, "tradingFeePercentage": 0, '
        + '"minimumTradingFeeFlat": 0, "securities": [{ "tick": "QDVE", "exchange": "IBIS2", '
        + '"shares": "100", "targetPercentage": 1 }] }')

      const error = await errorOf(driver.getPortfolioSettings('ibkr/eur'))

      expect(error.message.startsWith(`Invalid data file '${settingsPath('ibkr/eur')}':`)).toBe(true)
      expect(error.message).toContain('securities[0].shares')
    })

    it('throws "Invalid data file" for an empty file', async () => {
      const driver = givenFile('')

      await expect(driver.getPortfolioSettings('ibkr/eur')).rejects.toThrow(
        `Invalid data file '${settingsPath('ibkr/eur')}': JSONC syntax error: ValueExpected at 1:1`,
      )
    })

    it('reports JSONC syntax errors with the code and line:column instead of recovering', async () => {
      const driver = givenFile(
        EUR_SETTINGS_JSONC.replace('"brokerageFeeFlat": 1,', '"brokerageFeeFlat": 1,,'),
      )

      const error = await errorOf(driver.getPortfolioSettings('ibkr/eur'))

      expect(error.message.startsWith(
        `Invalid data file '${settingsPath('ibkr/eur')}': `
        + 'JSONC syntax error: PropertyNameExpected at 3:25',
      )).toBe(true)
    })

    it('accepts trailing commas', async () => {
      const driver = givenFile(
        EUR_SETTINGS_JSONC.replace('"targetPercentage": 0.6 }', '"targetPercentage": 0.6, },'),
      )

      await expect(driver.getPortfolioSettings('ibkr/eur')).resolves.toEqual(EUR_SETTINGS)
    })

    it('reports out-of-range values with the file and field path', async () => {
      const driver = givenFile(EUR_SETTINGS_JSONC.replace('"shares": 100', '"shares": -1'))

      const error = await errorOf(driver.getPortfolioSettings('ibkr/eur'))

      expect(error.message.startsWith(`Invalid data file '${settingsPath('ibkr/eur')}':\n`))
        .toBe(true)
      expect(error.message).toContain('securities[0].shares')
    })

    it('rejects an id that would resolve to a file outside the broker folders', async () => {
      // 'ibkr/../eur' would resolve to <dataDir>/eur.jsonc
      const driver = givenFiles({ 'eur.jsonc': EUR_SETTINGS_JSONC })

      await expect(driver.getPortfolioSettings('ibkr/../eur'))
        .rejects.toThrow(/^Invalid portfolio 'ibkr\/\.\.\/eur'/)
    })
  })
})
