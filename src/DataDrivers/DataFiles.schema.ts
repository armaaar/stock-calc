import { z } from 'zod'

const NonEmptyString = z.string().trim().min(1, 'Must not be empty')

/** A fraction between 0 and 1 (e.g. 0.4 = 40%). */
const Fraction = z.number().min(0).max(1)

const NonNegative = z.number().min(0)

/** A 3-letter currency code, such as EUR: exchange rates are looked up as `<FROM><TO>`. */
const CurrencyCode = z.string().regex(/^[A-Z]{3}$/, 'Must be a 3-letter currency code, such as EUR')

/**
 * The parts of a broker's tariff for one order. Each part is optional wherever it's set: a
 * security's part replaces its portfolio's, a portfolio's replaces its broker's, and a part set
 * nowhere is 0.
 */
const FeesShape = {
  brokerageFeeFlat: NonNegative.optional(),
  tradingFeePercentage: Fraction.optional(),
  minimumTradingFeeFlat: NonNegative.optional(),
  /** The share of a converted order's value charged to exchange the currency. */
  fxFeePercentage: Fraction.optional(),
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
  /**
   * The currency the security is traded in, when a source could quote another listing of it: a
   * quote in another currency is then skipped, so the next source prices this listing.
   */
  currency: CurrencyCode.optional(),
  ...FeesShape,
}).strict() // a misspelled optional fee would otherwise be dropped silently

/** `<broker>/_broker.jsonc`: what every portfolio of the broker shares unless it sets its own. */
export const BrokerSchema = z.object(SharedShape).strict()

/** `<broker>/<portfolio>.jsonc`. */
export const SettingsSchema = z.object({
  ...SharedShape,
  /**
   * The currency orders are paid in. Securities listed in another one are converted at an
   * exchange rate. By default, the currency of the first security's quote.
   */
  currency: CurrencyCode.optional(),
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

/** A hand-entered exchange rate: one unit of FROM is worth `rate` TO. */
export const OverrideRateSchema = z.object({
  rate: z.number().positive(),
  asOf: z.iso.date().optional(),
}).strict()

/** `<FROM>/<TO>`, such as `USD/EUR`. Ticks never contain a '/'. */
const CURRENCY_PAIR = /^([A-Z]{3})\/([A-Z]{3})$/

/**
 * `<broker>/<portfolio>.overrides.jsonc`: prices keyed by tick, and exchange rates keyed by
 * currency pair (`"USD/EUR"`). Each entry is checked against its own shape, with errors reported
 * at its key.
 */
export const OverridesSchema = z.record(z.string(), z.unknown()).transform((entries, ctx) => {
  const prices: Record<string, z.infer<typeof OverridePriceSchema>> = {}
  const rates: Record<string, z.infer<typeof OverrideRateSchema>> = {}

  for (const [key, value] of Object.entries(entries)) {
    if (!key.includes('/')) {
      const price = OverridePriceSchema.safeParse(value)
      if (price.success) prices[key] = price.data
      else reportAt(ctx, key, price.error)
      continue
    }

    const pair = CURRENCY_PAIR.exec(key)
    if (!pair || pair[1] === pair[2]) {
      ctx.addIssue({
        code: 'custom',
        message: 'A rate is keyed <FROM>/<TO> with two different 3-letter currency codes, such as USD/EUR',
        path: [key],
      })
      continue
    }
    const rate = OverrideRateSchema.safeParse(value)
    if (rate.success) rates[key] = rate.data
    else reportAt(ctx, key, rate.error)
  }

  return { prices, rates }
})

/** Re-reports an entry's issues under its key, so the file error names it. */
function reportAt(ctx: z.RefinementCtx, key: string, error: z.ZodError) {
  for (const issue of error.issues) {
    ctx.addIssue({ code: 'custom', message: issue.message, path: [key, ...issue.path] })
  }
}

export function parseDataFile<T>(schema: z.ZodType<T>, data: unknown, filePath: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw Error(`Invalid data file '${filePath}':\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
