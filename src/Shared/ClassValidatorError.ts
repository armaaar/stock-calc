import { validateSync, ValidationError } from 'class-validator'

export class ClassValidatorError extends Error {
  public errors: ValidationError[]

  constructor(message: string, errors: ValidationError[]) {
    super(message)
    this.name = this.constructor.name
    this.errors = errors
  }
}

export function validateClassErrors(
  object: object,
  cls: abstract new (...args: never[]) => object,
): void {
  // Only the most-derived constructor validates, once every field is set
  if (object.constructor !== cls) return

  const errors = validateSync(object)
  if (errors.length > 0) {
    throw new ClassValidatorError(`Class '${object.constructor.name}' validation failed`, errors)
  }
}
