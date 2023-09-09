export const ACCEPTABLE_DIFFERENCE = 0.1

export function roundPercentage(percentage: number) {
    return Math.round(percentage * 10000) / 100
}
