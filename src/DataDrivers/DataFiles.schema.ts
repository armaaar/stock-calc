import { z } from 'zod'

export const SettingsSecuritySchema = z.object({
  tick: z.string(),
  exchange: z.string(),
  isin: z.string().optional(),
  shares: z.number(),
  targetPercentage: z.number(),
})

export const SettingsSchema = z.object({
  brokerageFeeFlat: z.number(),
  tradingFeePercentage: z.number(),
  minimumTradingFeeFlat: z.number(),
  securities: z.array(SettingsSecuritySchema),
})

export const SecurityPriceSchema = z.object({
  price: z.number(),
  currency: z.string(),
})

export const OverridesSchema = z.record(z.string(), SecurityPriceSchema)

export function parseDataFile<T>(schema: z.ZodType<T>, data: unknown, filePath: string): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    throw Error(`Invalid data file '${filePath}':\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
