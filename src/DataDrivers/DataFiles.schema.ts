import { z } from 'zod'

const NonEmptyString = z.string().trim().min(1, 'Must not be empty')

/** A fraction between 0 and 1 (e.g. 0.4 = 40%). */
const Fraction = z.number().min(0).max(1)

const NonNegative = z.number().min(0)

/**
 * The three parts of a broker's tariff for one order. Each part is optional wherever it's set: a
 * security's part replaces its portfolio's, a portfolio's replaces its broker's, and a part set
 * nowhere is 0.
 */
const FeesShape = {
  brokerageFeeFlat: NonNegative.optional(),
  tradingFeePercentage: Fraction.optional(),
  minimumTradingFeeFlat: NonNegative.optional(),
}

/** Settings a broker's portfolios share, for example its fees. */
const SharedShape = {
  ...FeesShape,
  /** Warn about orders whose fee is more than this fraction of their value (default 0.01). */
  feeWarningPercentage: Fraction.optional(),
}

export const SettingsSecuritySchema = z.object({
  tick: NonEmptyString,
  exchange: NonEmptyString,
  isin: z.string().optional(),
  shares: z.number().int().min(0),
  targetPercentage: Fraction,
  ...FeesShape,
}).strict() // a misspelled optional fee would otherwise be dropped silently

/** `<broker>/_broker.jsonc`: what every portfolio of the broker shares unless it sets its own. */
export const BrokerSchema = z.object(SharedShape).strict()

/** `<broker>/<portfolio>.jsonc`. */
export const SettingsSchema = z.object({
  ...SharedShape,
  /** Uninvested cash held with the holdings, in the portfolio's currency. */
  cash: NonNegative.optional(),
  securities: z.array(SettingsSecuritySchema),
}).strict()

export const SecurityPriceSchema = z.object({
  price: z.number().positive(),
  currency: NonEmptyString,
})

/** A hand-entered price; `asOf` (YYYY-MM-DD) records when it was looked up. */
export const OverridePriceSchema = SecurityPriceSchema.extend({
  asOf: z.iso.date().optional(),
})

export const OverridesSchema = z.record(z.string(), OverridePriceSchema)

export function parseDataFile<T>(schema: z.ZodType<T>, data: unknown, filePath: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw Error(`Invalid data file '${filePath}':\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
