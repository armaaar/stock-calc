import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import {
  PortfolioView, PresentMode, RateView, SecurityView, toPortfolioView,
} from '#src/ViewModels/PortfolioView.ViewModel'

export { PresentMode }

const securitySchema = z.object({
  tick: z.string(),
  exchange: z.string().optional(),
  currency: z.string().optional().describe('The portfolio\'s currency, which price is in'),
  price: z.number(),
  listedPrice: z.number().optional()
    .describe('Listed in another currency only: the quoted price, in listedCurrency'),
  listedCurrency: z.string().optional()
    .describe('Listed in another currency only: the currency it is quoted in'),
  exchangeRate: z.number().optional()
    .describe('Listed in another currency only: what one unit of listedCurrency is worth'),
  priceSource: z.string().optional().describe('Where the price came from, e.g. justetf.com or override'),
  pricedAt: z.string().optional()
    .describe('When the price was quoted: ISO 8601 UTC timestamp, or a date for overrides'),
  targetPercent: z.number().describe('Target weight in percent'),
  shares: z.number(),
  totalPrice: z.number(),
  percent: z.number().describe(
    'Actual weight in percent (trades only: share of the gross value bought and sold)',
  ),
  tradedShares: z.number().optional().describe('Positive to buy, negative to sell'),
  tradedPrice: z.number().optional().describe('Positive to buy, negative to sell'),
  tradingFee: z.number().optional(),
  feePercent: z.number().optional().describe('The fee as a percentage of the order value'),
}) satisfies z.ZodType<SecurityView>

const rateSchema = z.object({
  from: z.string(),
  to: z.string(),
  rate: z.number().describe('What one unit of from is worth in to'),
  source: z.string().optional().describe('Where the rate came from, e.g. tradingview.com or override'),
  quotedAt: z.string().optional()
    .describe('When the rate was quoted: ISO 8601 UTC timestamp, or a date for overrides'),
}) satisfies z.ZodType<RateView>

/** The tool output schema: a `PortfolioView`, described for clients. */
export const portfolioOutputSchema = {
  portfolio: z.string().optional().describe('The portfolio id, <broker>/<portfolio>'),
  currency: z.string().optional().describe('The currency every price and amount is in'),
  securities: z.array(securitySchema),
  rates: z.array(rateSchema).optional()
    .describe('The exchange rates securities listed in another currency were converted at'),
  portfolioPrice: z.number().optional(),
  tradedPrice: z.number().optional().describe('Net cash needed (positive) or released (negative)'),
  tradingFee: z.number().optional(),
  cash: z.number().optional().describe('Current holdings only: uninvested cash held now'),
  cashAfterTrades: z.number().optional().describe(
    'Cash left once the plan is carried out: cash held + money added - net traded - fees. '
    + 'Negative: how much more money the plan needs',
  ),
  warnings: z.array(z.string()).optional().describe(
    'Orders whose fee is more than the portfolio\'s fee warning percentage of their value',
  ),
}

export type PortfolioOutput = z.infer<z.ZodObject<typeof portfolioOutputSchema>>

/** Returns a `PortfolioView` as structured content, plus the same JSON as text. */
export class PortfolioMcpPresenter {
  public static present(
    portfolio: Portfolio,
    mode: PresentMode = PresentMode.ONLY_NEW,
  ): CallToolResult {
    const output: PortfolioOutput = toPortfolioView(portfolio, mode) satisfies PortfolioView
    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    }
  }
}
