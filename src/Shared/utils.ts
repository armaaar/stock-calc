export function roundToClosestMultiply(num: number, step: number): number {
  return Math.round(num / step) * step
}

export function roundPercentage(percentage: number): number {
  return Math.round(percentage * 10000) / 100
}

export function sortObjectByKey<T extends object>(
  object: T,
  keys: (keyof T)[],
): T {
  const orderedObject = {} as T
  keys.forEach((key) => {
    if (object[key] !== undefined) {
      orderedObject[key] = object[key]
    }
  })
  return orderedObject as T
}
