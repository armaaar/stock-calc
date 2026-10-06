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

  /** A driver over a fresh data folder holding only `_overrides.<type>.jsonc` (if given). */
  function givenFile(content: string | undefined, type = 'EUR') {
    dataDir = createDataDir(content === undefined ? {} : { [`_overrides.${type}.jsonc`]: content })
    return new OverridesDataDriver(dataDir)
  }

  const overridesPath = (type: string) => path.join(dataDir, `_overrides.${type}.jsonc`)

  async function errorOf(promise: Promise<unknown>): Promise<Error> {
    const error = await promise.then(() => undefined, (e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    return error as Error
  }

  afterEach(() => {
    vi.restoreAllMocks()
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it('reads <dataDir>/_overrides.<TYPE>.jsonc', async () => {
    const driver = givenFile(EUR_OVERRIDES_JSONC, 'EGP')
    const existsSync = vi.spyOn(fs, 'existsSync')
    const readFileSync = vi.spyOn(fs, 'readFileSync')

    await expect(driver.getPortfolioOverrides('EGP')).resolves.toEqual(EUR_OVERRIDES)

    expect(existsSync).toHaveBeenCalledWith(overridesPath('EGP'))
    expect(readFileSync).toHaveBeenCalledWith(overridesPath('EGP'))
  })

  it('returns the parsed overrides, accepting JSONC comments', async () => {
    const driver = givenFile(EUR_OVERRIDES_JSONC)

    await expect(driver.getPortfolioOverrides('EUR')).resolves.toEqual(EUR_OVERRIDES)
  })

  it('returns {} when the overrides file is missing', async () => {
    const driver = givenFile(undefined)
    const readFileSync = vi.spyOn(fs, 'readFileSync')

    await expect(driver.getPortfolioOverrides('EUR')).resolves.toEqual({})
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it('does not read the overrides file of another portfolio', async () => {
    const driver = givenFile(EUR_OVERRIDES_JSONC, 'EUR')

    await expect(driver.getPortfolioOverrides('EGP')).resolves.toEqual({})
  })

  it('returns {} for a file with an empty object', async () => {
    const driver = givenFile('{ /* nothing overridden */ }')

    await expect(driver.getPortfolioOverrides('EUR')).resolves.toEqual({})
  })

  it('throws an "Invalid data file" error with the field path for an invalid shape', async () => {
    const driver = givenFile('{ "QDVE": { "price": "28.45", "currency": "EUR" } }')

    const error = await errorOf(driver.getPortfolioOverrides('EUR'))

    expect(error.message.startsWith(`Invalid data file '${overridesPath('EUR')}':`)).toBe(true)
    expect(error.message).toContain('QDVE.price')
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '  \n\t\r\n'],
    ['comments-only', '// no overrides yet\n/* "QDVE": { "price": 1, "currency": "EUR" } */\n'],
  ])('returns {} for an %s file, like a missing one', async (_case, content) => {
    const driver = givenFile(content)

    await expect(driver.getPortfolioOverrides('EUR')).resolves.toEqual({})
  })

  it('reports JSONC syntax errors with the code and line:column instead of recovering', async () => {
    const driver = givenFile('{\n  "QDVE": { "price": 28.45 "currency": "EUR" }\n}')

    const error = await errorOf(driver.getPortfolioOverrides('EUR'))

    expect(error.message).toBe(
      `Invalid data file '${overridesPath('EUR')}': JSONC syntax error: CommaExpected at 2:28`,
    )
  })

  it('rejects a non-positive override price with the file and field path', async () => {
    const driver = givenFile('{ "QDVE": { "price": 0, "currency": "EUR" } }')

    const error = await errorOf(driver.getPortfolioOverrides('EUR'))

    expect(error.message.startsWith(`Invalid data file '${overridesPath('EUR')}':\n`)).toBe(true)
    expect(error.message).toContain('QDVE.price')
  })

  it('rejects an invalid portfolio name before touching the file system', async () => {
    const driver = givenFile(undefined)
    const existsSync = vi.spyOn(fs, 'existsSync')
    const readFileSync = vi.spyOn(fs, 'readFileSync')

    await expect(driver.getPortfolioOverrides('../../x')).rejects.toThrow(
      'Invalid portfolio name \'../../x\': use letters, digits, \'_\' or \'-\'',
    )
    expect(existsSync).not.toHaveBeenCalled()
    expect(readFileSync).not.toHaveBeenCalled()
  })
})
