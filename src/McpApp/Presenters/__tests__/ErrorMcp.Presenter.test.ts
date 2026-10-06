import { describe, expect, it } from 'vitest'
import { ValidationError } from 'class-validator'
import { ClassValidatorError } from '@/Shared/ClassValidatorError'
import { PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity'
import { ErrorMcpPresenter } from '../ErrorMcp.Presenter'

function textOf(error: unknown): string {
  const result = ErrorMcpPresenter.present(error)
  expect(result.isError).toBe(true)
  expect(result.content).toHaveLength(1)
  return (result.content[0] as { text: string }).text
}

describe('ErrorMcpPresenter', () => {
  it('presents an Error with its name and message', () => {
    expect(textOf(new TypeError('bad type'))).toBe('TypeError: bad type')
  })

  it('presents non-Error values as strings', () => {
    expect(textOf('plain failure')).toBe('plain failure')
    expect(textOf(42)).toBe('42')
  })

  it('presents every error inside an AggregateError, recursively', () => {
    const error = new AggregateError([
      Error('ISIN \'X\' is not registered in justetf.com'),
      new AggregateError([Error('nested')]),
    ])

    expect(textOf(error)).toBe([
      'Error: ISIN \'X\' is not registered in justetf.com',
      'Error: nested',
    ].join('\n'))
  })

  it('presents a ClassValidatorError with its constraints', () => {
    let error: unknown
    try {
      new PortfolioSecurity({ tick: 'QDVE', price: 1, shares: 1.5, targetPercentage: 2 })
    } catch (e) {
      error = e
    }

    const text = textOf(error)
    expect(text.split('\n')[0])
      .toBe('ClassValidatorError: Class \'PortfolioSecurity\' validation failed')
    expect(text).toContain('  PortfolioSecurity.shares:')
    expect(text).toContain('    - shares must be an integer number')
    expect(text).toContain('  PortfolioSecurity.targetPercentageValue:')
    expect(text).toContain('    - targetPercentageValue must not be greater than 1')
  })

  it('presents nested validation errors indented under their parent', () => {
    class Holding {}
    const child = new ValidationError()
    child.target = new Holding()
    child.property = 'tick'
    child.constraints = { isNotEmpty: 'tick should not be empty' }
    const parent = new ValidationError()
    parent.property = 'securities'
    parent.children = [child]

    const text = textOf(new ClassValidatorError('failed', [parent]))

    expect(text).toBe([
      'ClassValidatorError: failed',
      '  securities:',
      '    Holding.tick:',
      '      - tick should not be empty',
    ].join('\n'))
  })
})
