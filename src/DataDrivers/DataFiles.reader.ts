import path from 'path'
import { parse, ParseError, printParseErrorCode, stripComments } from 'jsonc-parser'
import { PORTFOLIO_NAME_PATTERN } from '@/Shared/portfolioName'

/** How many JSONC syntax errors an "Invalid data file" message lists. */
const MAX_REPORTED_SYNTAX_ERRORS = 3

export function assertPortfolioName(type: string): void {
  if (!PORTFOLIO_NAME_PATTERN.test(type)) {
    throw Error(`Invalid portfolio name '${type}': use letters, digits, '_' or '-'`)
  }
}

/** `src/data/<prefix>.<type>.jsonc`, after checking that `type` is a valid portfolio name. */
export function dataFilePath(prefix: '_settings' | '_overrides', type: string): string {
  assertPortfolioName(type)
  return path.resolve(import.meta.dirname, '../data', `${prefix}.${type}.jsonc`)
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
