import { validateSync, ValidationError } from 'class-validator'

export class ClassValidatorError extends Error {
  public errors: ValidationError[]

  constructor(message: string, errors: ValidationError[]) {
    super(message)
    this.name = this.constructor.name
    this.errors = errors
  }
}

export function validateClassErrors(object: object, cls: new (...args: any[]) => any): void {
  // Only validate if the object is of the exact same class
  if (object.constructor.name !== cls.name) return

  const errors = validateSync(object)
  if (errors.length > 0) {
    throw new ClassValidatorError(`Class '${object.constructor.name}' validation failed`, errors)
  }
}
