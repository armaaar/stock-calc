import { beforeEach, describe, expect, it } from 'vitest'
import { ValidationError } from 'class-validator'
import { ClassValidatorError } from '@/Shared/ClassValidatorError'
import { PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity'
import { QDVE } from '@/__fixtures__/portfolio'
import { ConsoleSpies, printedLines, spyOnConsole } from '@/__fixtures__/console'
import { ErrorCliPresenter } from '.././ErrorCliPresenter.Presenter'

class Holding {}

class Account {}

function validationError(props: Partial<ValidationError>): ValidationError {
  return Object.assign(new ValidationError(), props)
}

describe('ErrorCliPresenter.present', () => {
  let spies: ConsoleSpies

  beforeEach(() => {
    spies = spyOnConsole()
  })

  it('prints a plain Error as "<name>: <message>" in red', () => {
    ErrorCliPresenter.present(new Error('Settings file not found'))

    expect(printedLines(spies.error)).toEqual(['Error: Settings file not found'])
    expect(spies.table).not.toHaveBeenCalled()
  })

  it('uses the name of Error subclasses', () => {
    ErrorCliPresenter.present(new TypeError('x is not a function'))

    expect(printedLines(spies.error)).toEqual(['TypeError: x is not a function'])
  })

  it.each([
    ['a string', 'boom', 'boom'],
    ['a number', 42, '42'],
    ['undefined', undefined, 'undefined'],
    ['null', null, 'null'],
    ['an object', { reason: 'x' }, '[object Object]'],
  ])('prints %s thrown as a non-Error with String()', (_, thrown, expected) => {
    ErrorCliPresenter.present(thrown)

    expect(spies.error).toHaveBeenCalledWith(expected)
    expect(printedLines(spies.error)).toEqual([expected])
  })

  it('presents every error of an AggregateError, recursing into nested ones', () => {
    ErrorCliPresenter.present(new AggregateError([
      new Error('JustEtf timed out'),
      new AggregateError([new RangeError('nested'), 'raw value']),
      new Error('TradingView failed'),
    ], 'All promises were rejected'))

    // The AggregateError's own message is not printed.
    expect(printedLines(spies.error)).toEqual([
      'Error: JustEtf timed out',
      'RangeError: nested',
      'raw value',
      'Error: TradingView failed',
    ])
  })

  it('prints nothing for an empty AggregateError', () => {
    ErrorCliPresenter.present(new AggregateError([]))

    expect(spies.error).not.toHaveBeenCalled()
  })

  it('prints a ClassValidatorError with its constraints and nested children', () => {
    const account = new Account()
    const holding = new Holding()
    const error = new ClassValidatorError('Class \'Account\' validation failed', [
      validationError({
        target: account,
        property: 'holdings',
        children: [
          validationError({
            target: holding,
            property: 'shares',
            constraints: { min: 'shares must not be less than 0', isInt: 'shares must be an integer' },
            children: [
              validationError({
                target: holding,
                property: 'deep',
                constraints: { isNotEmpty: 'deep should not be empty' },
              }),
            ],
          }),
        ],
      }),
      validationError({
        target: account,
        property: 'name',
        constraints: { isNotEmpty: 'name should not be empty' },
        children: [],
      }),
    ])

    ErrorCliPresenter.present(error)

    expect(printedLines(spies.error)).toEqual([
      'ClassValidatorError: Class \'Account\' validation failed',
      '- Errors For \'Account\' => \'holdings\'',
      '-- Errors For \'Holding\' => \'shares\'',
      '--- Errors For \'Holding\' => \'deep\'',
      '- Errors For \'Account\' => \'name\'',
    ])
    expect(spies.table.mock.calls).toEqual([
      [{ min: 'shares must not be less than 0', isInt: 'shares must be an integer' }],
      [{ isNotEmpty: 'deep should not be empty' }],
      [{ isNotEmpty: 'name should not be empty' }],
    ])
  })

  it('prints "undefined" as the class name when a validation error has no target', () => {
    ErrorCliPresenter.present(new ClassValidatorError('failed', [
      validationError({ property: 'value', constraints: { min: 'value must not be less than 0' } }),
    ]))

    // Current behaviour: a missing target is shown as the literal string 'undefined'.
    expect(printedLines(spies.error)).toEqual([
      'ClassValidatorError: failed',
      '- Errors For \'undefined\' => \'value\'',
    ])
    expect(spies.table).toHaveBeenCalledWith({ min: 'value must not be less than 0' })
  })

  it('presents a real entity validation failure', () => {
    let thrown: unknown
    try {
      new PortfolioSecurity({ ...QDVE, shares: 1.5, initialShares: 100 })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(ClassValidatorError)

    ErrorCliPresenter.present(thrown)

    expect(printedLines(spies.error)).toEqual([
      'ClassValidatorError: Class \'PortfolioSecurity\' validation failed',
      '- Errors For \'PortfolioSecurity\' => \'shares\'',
    ])
    expect(spies.table).toHaveBeenCalledWith({ isInt: 'shares must be an integer number' })
  })

  it('presents a ClassValidatorError inside an AggregateError', () => {
    ErrorCliPresenter.present(new AggregateError([
      new ClassValidatorError('invalid', [validationError({ target: new Holding(), property: 'x' })]),
      new Error('other'),
    ]))

    expect(printedLines(spies.error)).toEqual([
      'ClassValidatorError: invalid',
      '- Errors For \'Holding\' => \'x\'',
      'Error: other',
    ])
    expect(spies.table).not.toHaveBeenCalled()
  })
})
