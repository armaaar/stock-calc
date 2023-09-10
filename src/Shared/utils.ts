import { validateSync } from 'class-validator';

export function roundToClosestMultiply(num: number, step: number): number {
  return Math.round(num / step) * step;
}

export function roundPercentage(percentage: number): number {
  return Math.round(percentage * 10000) / 100;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function validateClassErrors(object: object, cls: Function): void {
  // Only validate if the object is of the exact same class
  if (object.constructor.name !== cls.name) return;

  const errors = validateSync(object);
  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error(errors);
    throw Error('Validation failed.');
  }
}
