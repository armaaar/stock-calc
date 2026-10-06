import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EUR_SETTINGS, EUR_SETTINGS_JSONC } from '@/__fixtures__/dataFiles'
import {
  assertPortfolioName, DATA_DIR_ENV, dataDirectory, dataFilePath, isBlankJsonc, parseJsonc,
} from '../DataFiles.reader'
import { PORTFOLIO_NAME_PATTERN } from '@/Shared/portfolioName'

const FILE = '/data/_settings.TEST.jsonc'

const toPosix = (p: string) => p.replace(/\\/g, '/')

function errorMessage(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    return (e as Error).message
  }
  throw Error('expected the call to throw')
}

describe('assertPortfolioName', () => {
  it.each(['EUR', 'egp', 'TMP_2', 'my-portfolio', '0'])('accepts %s', (name) => {
    expect(() => assertPortfolioName(name)).not.toThrow()
    expect(PORTFOLIO_NAME_PATTERN.test(name)).toBe(true)
  })

  it.each([
    '', '../../x', '..', 'a/b', 'a\\b', 'EUR.jsonc', 'E UR', 'C:', 'EUR\n', 'ÄÖ', '~',
  ])('rejects %j', (name) => {
    expect(() => assertPortfolioName(name)).toThrow(
      `Invalid portfolio name '${name}': use letters, digits, '_' or '-'`,
    )
  })
})

describe('dataDirectory', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['blank', '   '],
  ])('defaults to src/data when %s', (_, value) => {
    vi.stubEnv(DATA_DIR_ENV, value)

    expect(toPosix(dataDirectory())).toMatch(/\/src\/data$/)
  })

  it('uses the folder from STOCK_CALC_DATA_DIR', () => {
    const folder = path.join(os.tmpdir(), 'portfolios')
    vi.stubEnv(DATA_DIR_ENV, ` ${folder} `)

    expect(dataDirectory()).toBe(path.resolve(folder))
    expect(dataFilePath('_settings', 'EUR')).toBe(path.join(folder, '_settings.EUR.jsonc'))
  })

  it.each([
    ['~', ''],
    ['~/portfolios', 'portfolios'],
    ['~\\portfolios', 'portfolios'],
  ])('expands a leading ~ in %s to the home folder', (value, rest) => {
    vi.stubEnv(DATA_DIR_ENV, value)

    expect(dataDirectory()).toBe(path.resolve(os.homedir(), rest))
  })

  it('keeps a ~ that is part of a folder name', () => {
    vi.stubEnv(DATA_DIR_ENV, '~portfolios')

    expect(dataDirectory()).toBe(path.resolve('~portfolios'))
  })
})

describe('dataFilePath', () => {
  it.each(['_settings', '_overrides'] as const)('resolves %s files inside src/data', (prefix) => {
    expect(toPosix(dataFilePath(prefix, 'EUR')))
      .toMatch(new RegExp(`/src/data/${prefix}\\.EUR\\.jsonc$`))
  })

  it('rejects a portfolio name that would leave src/data', () => {
    expect(() => dataFilePath('_settings', '../../../x'))
      .toThrow('Invalid portfolio name \'../../../x\': use letters, digits, \'_\' or \'-\'')
  })
})

describe('isBlankJsonc', () => {
  it.each([
    ['empty', ''],
    ['whitespace', ' \n\t\r\n'],
    ['a line comment', '// nothing here\n'],
    ['a block comment', '/* nothing\n here */'],
    ['mixed comments', '\n// a\n/* b */\n  // c'],
  ])('is true for %s', (_case, text) => {
    expect(isBlankJsonc(text)).toBe(true)
  })

  it.each(['{}', '// x\n{}', 'null', '0'])('is false for %j', (text) => {
    expect(isBlankJsonc(text)).toBe(false)
  })
})

describe('parseJsonc', () => {
  it('parses JSONC with comments', () => {
    expect(parseJsonc(EUR_SETTINGS_JSONC, FILE)).toEqual(EUR_SETTINGS)
  })

  it('allows trailing commas', () => {
    expect(parseJsonc('{ "a": [1, 2,], }', FILE)).toEqual({ a: [1, 2] })
  })

  it('reports the error code and the 1-based line:column of a syntax error', () => {
    const text = '{\n  "a": 1,,\n  "b": 2\n}'

    expect(errorMessage(() => parseJsonc(text, FILE))).toBe(
      `Invalid data file '${FILE}': JSONC syntax error: `
      + 'PropertyNameExpected at 2:10, ValueExpected at 2:10',
    )
  })

  it('counts columns from the start of the line for CRLF files', () => {
    const text = '{\r\n"a": 1\r\n"b": 2\r\n}'

    expect(errorMessage(() => parseJsonc(text, FILE)))
      .toBe(`Invalid data file '${FILE}': JSONC syntax error: CommaExpected at 3:1`)
  })

  it('treats an empty text as an error', () => {
    expect(errorMessage(() => parseJsonc('', FILE)))
      .toBe(`Invalid data file '${FILE}': JSONC syntax error: ValueExpected at 1:1`)
  })

  it('lists at most the first 3 errors and counts the rest', () => {
    const text = '{ "a" 1, "b" 2, "c" 3, "d" 4, "e" 5 }'

    const message = errorMessage(() => parseJsonc(text, FILE))

    expect(message).toMatch(
      /^Invalid data file '.*': JSONC syntax error: ColonExpected at 1:7, ColonExpected at 1:14, ColonExpected at 1:21 \(and 2 more\)$/,
    )
  })
})
