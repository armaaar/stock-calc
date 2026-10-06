import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import {
  PortfolioView, PresentMode, SecurityView, toPortfolioView,
} from '#src/ViewModels/PortfolioView.ViewModel'

export { PresentMode }

const securitySchema = z.object({
  tick: z.string(),
  exchange: z.string().optional(),
  currency: z.string().optional(),
  price: z.number(),
  targetPercent: z.number().describe('Target weight in percent'),
  shares: z.number(),
  totalPrice: z.number(),
  percent: z.number().describe(
    'Actual weight in percent (trades only: share of the gross value bought and sold)',
  ),
  tradedShares: z.number().optional().describe('Positive to buy, negative to sell'),
  tradedPrice: z.number().optional().describe('Positive to buy, negative to sell'),
  tradingFee: z.number().optional(),
}) satisfies z.ZodType<SecurityView>

/** The tool output schema: a `PortfolioView`, described for clients. */
export const portfolioOutputSchema = {
  currency: z.string().optional(),
  securities: z.array(securitySchema),
  portfolioPrice: z.number().optional(),
  tradedPrice: z.number().optional().describe('Net cash needed (positive) or released (negative)'),
  tradingFee: z.number().optional(),
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
