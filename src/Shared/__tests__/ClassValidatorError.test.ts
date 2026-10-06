import { IsInt, Min, ValidationError } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { ClassValidatorError, validateClassErrors } from '../ClassValidatorError'

class Counter {
  @IsInt()
  @Min(0)
  public count: number

  constructor(count: number, validate = true) {
    this.count = count
    if (validate) validateClassErrors(this, Counter)
  }
}

class NamedCounter extends Counter {
  public name: string

  constructor(count: number, name: string) {
    super(count)
    this.name = name
    validateClassErrors(this, NamedCounter)
  }
}

describe('ClassValidatorError', () => {
  it('is an Error carrying the validation errors', () => {
    const errors = [new ValidationError()]
    const error = new ClassValidatorError('boom', errors)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('boom')
    expect(error.name).toBe('ClassValidatorError')
    expect(error.errors).toBe(errors)
  })

  it('takes its name from the most-derived class', () => {
    class CustomValidatorError extends ClassValidatorError {}

    expect(new CustomValidatorError('boom', []).name).toBe('CustomValidatorError')
  })
})

describe('validateClassErrors', () => {
  it('does nothing for a valid object', () => {
    expect(() => new Counter(1)).not.toThrow()
  })

  it('throws a ClassValidatorError listing the failed constraints', () => {
    let error: unknown
    try {
      new Counter(-1.5)
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(ClassValidatorError)
    const { message, errors } = error as ClassValidatorError
    expect(message).toBe('Class \'Counter\' validation failed')
    expect(errors).toHaveLength(1)
    expect(errors[0].property).toBe('count')
    expect(Object.keys(errors[0].constraints ?? {}).sort()).toEqual(['isInt', 'min'])
  })

  it('skips validation when the object is an instance of a subclass', () => {
    const counter = new Counter(1, false)
    counter.count = -1
    const named = Object.setPrototypeOf(counter, NamedCounter.prototype)

    expect(() => validateClassErrors(named, Counter)).not.toThrow()
    expect(() => validateClassErrors(named, NamedCounter)).toThrow(ClassValidatorError)
  })

  it('validates a subclass once, in the most-derived constructor, with inherited rules', () => {
    let error: unknown
    try {
      new NamedCounter(-1, 'x')
    } catch (e) {
      error = e
    }

    expect((error as ClassValidatorError).message).toBe('Class \'NamedCounter\' validation failed')
  })

  it('skips an unrelated class that merely shares the class name', () => {
    const Impostor = { Counter: class {} }.Counter

    expect(Impostor.name).toBe(Counter.name)
    expect(() => validateClassErrors(new Impostor(), Counter)).not.toThrow()
  })

  it('still validates an instance of the exact class', () => {
    const counter = new Counter(1)
    counter.count = -1

    expect(() => validateClassErrors(counter, Counter)).toThrow(ClassValidatorError)
  })
})
