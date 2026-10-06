import { InvalidArgumentError, Option } from '@commander-js/extra-typings'
import { PORTFOLIO_NAME_PATTERN } from '#src/Shared/portfolioName'

/** commander argument parser: a portfolio name made of letters, digits, '_' or '-'. */
export function parsePortfolioName(value: string): string {
  if (!PORTFOLIO_NAME_PATTERN.test(value)) {
    throw new InvalidArgumentError('Use letters, digits, \'_\' or \'-\'.')
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

export const portfolioOption = new Option('--pt, --portfolio <type>', 'the portfolio to use')
  .argParser(parsePortfolioName)
  .default('EUR')
