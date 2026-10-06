import fs from 'fs'
import os from 'os'
import path from 'path'
import { parse, ParseError, printParseErrorCode, stripComments } from 'jsonc-parser'
import type { z } from 'zod'
import { NAME_PATTERN, PORTFOLIO_ID_PATTERN, PORTFOLIO_ID_RULE } from '#src/Shared/portfolioName'
import { parseDataFile } from './DataFiles.schema'

/** How many JSONC syntax errors an "Invalid data file" message lists. */
const MAX_REPORTED_SYNTAX_ERRORS = 3

/** The broker's shared settings, inside its folder. */
export const BROKER_FILE = '_broker.jsonc'

export function assertPortfolioId(portfolioId: string): void {
  if (!PORTFOLIO_ID_PATTERN.test(portfolioId)) {
    throw Error(`Invalid portfolio '${portfolioId}': ${PORTFOLIO_ID_RULE}`)
  }
}

/** Environment variable pointing at the folder that holds the portfolio files. */
export const DATA_DIR_ENV = 'STOCK_CALC_DATA_DIR'

/**
 * The folder holding the portfolio files: `$STOCK_CALC_DATA_DIR` (a leading `~` means the home
 * folder), or `src/data` in this repository when it isn't set.
 */
export function dataDirectory(): string {
  const configured = process.env[DATA_DIR_ENV]?.trim()
  if (!configured) return path.resolve(import.meta.dirname, '../data')

  return path.resolve(configured.replace(/^~(?=$|[\\/])/, os.homedir()))
}

/** The files of a portfolio and of its broker, after checking the portfolio id. */
export function portfolioFiles(dataDir: string, portfolioId: string) {
  assertPortfolioId(portfolioId)
  const [broker, portfolio] = portfolioId.split('/')
  const brokerDir = path.resolve(dataDir, broker)
  return {
    /** `<dataDir>/<broker>/_broker.jsonc`: settings every portfolio of the broker shares. */
    broker: path.join(brokerDir, BROKER_FILE),
    /** `<dataDir>/<broker>/<portfolio>.jsonc` */
    settings: path.join(brokerDir, `${portfolio}.jsonc`),
    /** `<dataDir>/<broker>/<portfolio>.overrides.jsonc` */
    overrides: path.join(brokerDir, `${portfolio}.overrides.jsonc`),
  }
}

/** The ids of every portfolio in the data folder (`<broker>/<portfolio>`), sorted. */
export function listPortfolioIds(dataDir: string): string[] {
  if (!fs.existsSync(dataDir)) return []
  // '<name>.overrides.jsonc' and '_broker.jsonc' aren't portfolios: their names don't match
  const portfolioName = (file: fs.Dirent) => {
    const name = file.name.slice(0, -'.jsonc'.length)
    return file.isFile() && file.name.endsWith('.jsonc') && NAME_PATTERN.test(name) ? [name] : []
  }
  return fs.readdirSync(dataDir, { withFileTypes: true })
    .filter((broker) => broker.isDirectory() && NAME_PATTERN.test(broker.name))
    .flatMap((broker) => fs.readdirSync(path.join(dataDir, broker.name), { withFileTypes: true })
      .flatMap(portfolioName)
      .map((name) => `${broker.name}/${name}`))
    .sort()
}

/** True when the data folder still has portfolio files from before broker folders. */
export function hasLegacyPortfolioFiles(dataDir: string): boolean {
  return fs.existsSync(dataDir)
    && fs.readdirSync(dataDir).some((file) => /^_settings\..+\.jsonc$/.test(file))
}

/** True when the text holds nothing but whitespace and comments. */
export function isBlankJsonc(text: string): boolean {
  return stripComments(text).trim() === ''
}

function lineColumn(text: string, offset: number): string {
  const before = text.slice(0, offset)
  const line = before.split('\n').length
  const column = offset - before.lastIndexOf('\n')
  return `${line}:${column}`
}

/**
 * Parses JSONC (comments and trailing commas allowed). Throws `Invalid data file '<path>'`
 * naming the first syntax errors and their line:column instead of silently recovering.
 */
export function parseJsonc(text: string, filePath: string): unknown {
  const errors: ParseError[] = []
  const data: unknown = parse(text, errors, { allowTrailingComma: true })

  if (errors.length > 0) {
    const reported = errors.slice(0, MAX_REPORTED_SYNTAX_ERRORS)
      .map(({ error, offset }) => `${printParseErrorCode(error)} at ${lineColumn(text, offset)}`)
    const more = errors.length - reported.length
    const suffix = more > 0 ? ` (and ${more} more)` : ''
    throw Error(
      `Invalid data file '${filePath}': JSONC syntax error: ${reported.join(', ')}${suffix}`,
    )
  }

  return data
}

/**
 * Reads and validates a data file that may be left out: `undefined` when it's missing, empty or
 * holds only comments.
 */
export function readOptionalDataFile<T>(schema: z.ZodType<T>, filePath: string): T | undefined {
  if (!fs.existsSync(filePath)) return undefined

  const text = fs.readFileSync(filePath).toString()
  if (isBlankJsonc(text)) return undefined

  return parseDataFile(schema, parseJsonc(text, filePath), filePath)
}
