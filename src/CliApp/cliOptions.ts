import { InvalidArgumentError, Option } from '@commander-js/extra-typings'
import { PORTFOLIO_ID_PATTERN, PORTFOLIO_ID_RULE } from '#src/Shared/portfolioName'

/** commander argument parser: a portfolio id, `<broker>/<portfolio>`. */
export function parsePortfolioId(value: string): string {
  if (!PORTFOLIO_ID_PATTERN.test(value)) {
    throw new InvalidArgumentError(`Invalid portfolio: ${PORTFOLIO_ID_RULE}.`)
  }
  return value
}

/** commander argument parser: a finite number (negative numbers and exponents are fine). */
export function parseFiniteNumber(value: string): number {
  const number = Number(value)
  if (value.trim() === '' || !Number.isFinite(number)) {
    throw new InvalidArgumentError('Not a finite number.')
  }
  return number
}

export const portfolioOption = new Option(
  '--pt, --portfolio <broker/portfolio>',
  'the portfolio to use, e.g. ibkr/eur (default: the only portfolio in the data folder)',
).argParser(parsePortfolioId)
