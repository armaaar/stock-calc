import fs from 'fs'
import path from 'path'
import {
  afterEach, describe, expect, it, vi,
} from 'vitest'
import {
  createDataDir, EUR_OVERRIDES, EUR_OVERRIDES_JSONC,
} from '#src/__fixtures__/dataFiles'
import { OverridesDataDriver } from '../Overrides.DataDriver'

describe('OverridesDataDriver', () => {
  let dataDir: string

  /** A driver over a fresh data folder holding only `<id>.overrides.jsonc` (if given). */
  function givenFile(content: string | undefined, id = 'ibkr/eur') {
    dataDir = createDataDir(content === undefined ? {} : { [`${id}.overrides.jsonc`]: content })
    return new OverridesDataDriver(dataDir)
  }

  const overridesPath = (id: string) => path.join(dataDir, `${id}.overrides.jsonc`)

  async function errorOf(promise: Promise<unknown>): Promise<Error> {
    const error = await promise.then(() => undefined, (e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    return error as Error
  }

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it('reads <dataDir>/<broker>/<portfolio>.overrides.jsonc', async () => {
    const driver = givenFile(EUR_OVERRIDES_JSONC, 'thndr/egp')
    const existsSync = vi.spyOn(fs, 'existsSync')
    const readFileSync = vi.spyOn(fs, 'readFileSync')

    await expect(driver.getPortfolioOverrides('thndr/egp')).resolves.toEqual(EUR_OVERRIDES)

    expect(existsSync).toHaveBeenCalledWith(overridesPath('thndr/egp'))
    expect(readFileSync).toHaveBeenCalledWith(overridesPath('thndr/egp'))
  })

  it('returns the parsed overrides, accepting JSONC comments', async () => {
    const driver = givenFile(EUR_OVERRIDES_JSONC)

    await expect(driver.getPortfolioOverrides('ibkr/eur')).resolves.toEqual(EUR_OVERRIDES)
  })

  it('returns {} when the overrides file is missing', async () => {
    const driver = givenFile(undefined)
    const readFileSync = vi.spyOn(fs, 'readFileSync')

    await expect(driver.getPortfolioOverrides('ibkr/eur')).resolves.toEqual({})
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it('does not read the overrides file of another portfolio', async () => {
    const driver = givenFile(EUR_OVERRIDES_JSONC, 'ibkr/eur')

    await expect(driver.getPortfolioOverrides('thndr/egp')).resolves.toEqual({})
  })

  it('returns {} for a file with an empty object', async () => {
    const driver = givenFile('{ /* nothing overridden */ }')

    await expect(driver.getPortfolioOverrides('ibkr/eur')).resolves.toEqual({})
  })

  it('throws an "Invalid data file" error with the field path for an invalid shape', async () => {
    const driver = givenFile('{ "QDVE": { "price": "28.45", "currency": "EUR" } }')

    const error = await errorOf(driver.getPortfolioOverrides('ibkr/eur'))

    expect(error.message.startsWith(`Invalid data file '${overridesPath('ibkr/eur')}':`)).toBe(true)
    expect(error.message).toContain('QDVE.price')
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '  \n\t\r\n'],
    ['comments-only', '// no overrides yet\n/* "QDVE": { "price": 1, "currency": "EUR" } */\n'],
  ])('returns {} for an %s file, like a missing one', async (_case, content) => {
    const driver = givenFile(content)

    await expect(driver.getPortfolioOverrides('ibkr/eur')).resolves.toEqual({})
  })

  it('reports JSONC syntax errors with the code and line:column instead of recovering', async () => {
    const driver = givenFile('{\n  "QDVE": { "price": 28.45 "currency": "EUR" }\n}')

    const error = await errorOf(driver.getPortfolioOverrides('ibkr/eur'))

    expect(error.message).toBe(
      `Invalid data file '${overridesPath('ibkr/eur')}': JSONC syntax error: CommaExpected at 2:28`,
    )
  })

  it('rejects a non-positive override price with the file and field path', async () => {
    const driver = givenFile('{ "QDVE": { "price": 0, "currency": "EUR" } }')

    const error = await errorOf(driver.getPortfolioOverrides('ibkr/eur'))

    expect(error.message.startsWith(`Invalid data file '${overridesPath('ibkr/eur')}':\n`)).toBe(true)
    expect(error.message).toContain('QDVE.price')
  })

  it('rejects an invalid portfolio id before touching the file system', async () => {
    const driver = givenFile(undefined)
    const existsSync = vi.spyOn(fs, 'existsSync')
    const readFileSync = vi.spyOn(fs, 'readFileSync')

    await expect(driver.getPortfolioOverrides('../../x')).rejects.toThrow(
      'Invalid portfolio \'../../x\': use <broker>/<portfolio>, each made of letters, digits, '
      + '\'_\' or \'-\' and starting with a letter or digit',
    )
    expect(existsSync).not.toHaveBeenCalled()
    expect(readFileSync).not.toHaveBeenCalled()
  })
})
