import { z } from 'zod'

const NonEmptyString = z.string().trim().min(1, 'Must not be empty')

/** A fraction between 0 and 1 (e.g. 0.4 = 40%). */
const Fraction = z.number().min(0).max(1)

const NonNegative = z.number().min(0)

/** The three parts of a broker's tariff for one order. */
const FeesShape = {
  brokerageFeeFlat: NonNegative,
  tradingFeePercentage: Fraction,
  minimumTradingFeeFlat: NonNegative,
}

export const SettingsSecuritySchema = z.object({
  tick: NonEmptyString,
  exchange: NonEmptyString,
  isin: z.string().optional(),
  shares: z.number().int().min(0),
  targetPercentage: Fraction,
  // A fee part set here replaces the portfolio's for this security's orders only
  brokerageFeeFlat: FeesShape.brokerageFeeFlat.optional(),
  tradingFeePercentage: FeesShape.tradingFeePercentage.optional(),
  minimumTradingFeeFlat: FeesShape.minimumTradingFeeFlat.optional(),
}).strict() // a misspelled optional fee would otherwise be dropped silently

export const SettingsSchema = z.object({
  ...FeesShape,
  securities: z.array(SettingsSecuritySchema),
}).strict()

export const SecurityPriceSchema = z.object({
  price: z.number().positive(),
  currency: NonEmptyString,
})

export const OverridesSchema = z.record(z.string(), SecurityPriceSchema)

export function parseDataFile<T>(schema: z.ZodType<T>, data: unknown, filePath: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw Error(`Invalid data file '${filePath}':\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
