export function roundToClosestMultiply(num: number, step: number): number {
  return Math.round(num / step) * step
}

export function roundPercentage(percentage: number): number {
  return Math.round(percentage * 10000) / 100
}
