import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createDataDir, EUR_SETTINGS, EUR_SETTINGS_JSONC } from '#src/__fixtures__/dataFiles'
import {
  assertPortfolioId, DATA_DIR_ENV, dataDirectory, hasLegacyPortfolioFiles, isBlankJsonc,
  listPortfolioIds, parseJsonc, portfolioFiles, readOptionalDataFile,
} from '../DataFiles.reader'
import { PORTFOLIO_ID_PATTERN } from '#src/Shared/portfolioName'

const FILE = '/data/_settings.TEST.jsonc'

const INVALID_RULE = 'use <broker>/<portfolio>, each made of letters, digits, \'_\' or \'-\' and '
  + 'starting with a letter or digit'

const toPosix = (p: string) => p.replace(/\\/g, '/')

function errorMessage(fn: () => unknown): string {
  try {
    fn()
  } catch (e) {
    return (e as Error).message
  }
  throw Error('expected the call to throw')
}

describe('assertPortfolioId', () => {
  it.each(['ibkr/eur', 'thndr/EGP', 'b/TMP_2', 'my-broker/my-portfolio', '0/1'])(
    'accepts %s',
    (id) => {
      expect(() => assertPortfolioId(id)).not.toThrow()
      expect(PORTFOLIO_ID_PATTERN.test(id)).toBe(true)
    },
  )

  it.each([
    '', 'EUR', 'ibkr', 'ibkr/', '/eur', 'a/b/c', '../../x', '..', 'ibkr/..', 'ibkr/../eur',
    'ibkr\\eur', 'ibkr/eur.jsonc', 'ibkr/eur.overrides', 'ibkr/_broker', '_ibkr/eur',
    'ibkr/-eur', 'ibkr/E UR', 'C:/eur', 'ibkr/eur\n', 'ÄÖ/eur', '~/eur',
  ])('rejects %j', (id) => {
    expect(() => assertPortfolioId(id)).toThrow(`Invalid portfolio '${id}': ${INVALID_RULE}`)
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

describe('portfolioFiles', () => {
  const dataDir = path.join(os.tmpdir(), 'portfolios')

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves the portfolio\'s files and its broker\'s file inside the broker\'s folder', () => {
    expect(portfolioFiles(dataDir, 'ibkr/eur')).toEqual({
      broker: path.join(dataDir, 'ibkr', '_broker.jsonc'),
      settings: path.join(dataDir, 'ibkr', 'eur.jsonc'),
      overrides: path.join(dataDir, 'ibkr', 'eur.overrides.jsonc'),
    })
  })

  it('resolves a relative data folder against the working directory', () => {
    expect(portfolioFiles('portfolios', 'ibkr/eur').settings)
      .toBe(path.resolve('portfolios', 'ibkr', 'eur.jsonc'))
  })

  it('uses the given data folder, not STOCK_CALC_DATA_DIR', () => {
    vi.stubEnv(DATA_DIR_ENV, path.join(os.tmpdir(), 'elsewhere'))

    expect(portfolioFiles(dataDir, 'ibkr/eur').settings)
      .toBe(path.join(dataDir, 'ibkr', 'eur.jsonc'))
  })

  it('rejects a portfolio id that would leave the data folder', () => {
    expect(() => portfolioFiles(dataDir, '../../x'))
      .toThrow(`Invalid portfolio '../../x': ${INVALID_RULE}`)
  })
})

describe('listPortfolioIds', () => {
  let dataDir: string

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it('lists <broker>/<portfolio> for every portfolio file in a broker folder, sorted', () => {
    dataDir = createDataDir({
      'thndr/egp.jsonc': '{}',
      'ibkr/eur.jsonc': '{}',
      'ibkr/growth.jsonc': '{}',
      'ibkr/eur.overrides.jsonc': '{}',
      'ibkr/_broker.jsonc': '{}',
    })

    expect(listPortfolioIds(dataDir)).toEqual(['ibkr/eur', 'ibkr/growth', 'thndr/egp'])
  })

  it('skips files outside broker folders, other files, and folders it could not select', () => {
    dataDir = createDataDir({
      '_settings.EUR.jsonc': '{}',
      'eur.jsonc': '{}',
      'ibkr/notes.txt': '',
      'ibkr/my eur.jsonc': '{}',
      'ibkr/eur.jsonc/inner.jsonc': '{}',
      '_private/eur.jsonc': '{}',
      '.hidden/eur.jsonc': '{}',
    })

    expect(listPortfolioIds(dataDir)).toEqual([])
  })

  it('is empty when the data folder does not exist', () => {
    dataDir = path.join(createDataDir(), 'missing')

    expect(listPortfolioIds(dataDir)).toEqual([])
  })
})

describe('hasLegacyPortfolioFiles', () => {
  let dataDir: string

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it('is true when settings files from before broker folders are left', () => {
    dataDir = createDataDir({ '_settings.EUR.jsonc': '{}' })

    expect(hasLegacyPortfolioFiles(dataDir)).toBe(true)
  })

  it.each([
    ['broker folders only', { 'ibkr/eur.jsonc': '{}' }],
    ['an old overrides file only', { '_overrides.EUR.jsonc': '{}' }],
    ['an old example', { '_settings.EUR.jsonc.example': '{}' }],
  ])('is false with %s', (_, files) => {
    dataDir = createDataDir(files)

    expect(hasLegacyPortfolioFiles(dataDir)).toBe(false)
  })

  it('is false when the data folder does not exist', () => {
    dataDir = path.join(createDataDir(), 'missing')

    expect(hasLegacyPortfolioFiles(dataDir)).toBe(false)
  })
})

describe('readOptionalDataFile', () => {
  const Schema = z.object({ a: z.number() })
  let dataDir: string

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true })
  })

  it('parses and validates the file', () => {
    dataDir = createDataDir({ 'x.jsonc': '{ "a": 1, } // note' })

    expect(readOptionalDataFile(Schema, path.join(dataDir, 'x.jsonc'))).toEqual({ a: 1 })
  })

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['comments only', '// nothing yet'],
  ])('is undefined when the file is %s', (_, content) => {
    dataDir = createDataDir(content === undefined ? {} : { 'x.jsonc': content })

    expect(readOptionalDataFile(Schema, path.join(dataDir, 'x.jsonc'))).toBeUndefined()
  })

  it('throws "Invalid data file" for a file that does not match the schema', () => {
    dataDir = createDataDir({ 'x.jsonc': '{ "a": "1" }' })
    const file = path.join(dataDir, 'x.jsonc')

    expect(() => readOptionalDataFile(Schema, file)).toThrow(`Invalid data file '${file}':`)
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
