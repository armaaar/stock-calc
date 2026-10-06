import { z } from 'zod'
import Decimal from 'decimal.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { roundPercentage } from '#src/Shared/utils'

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
})

export const portfolioOutputSchema = {
  currency: z.string().optional(),
  securities: z.array(securitySchema),
  portfolioPrice: z.number().optional(),
  tradedPrice: z.number().optional().describe('Net cash needed (positive) or released (negative)'),
  tradingFee: z.number().optional(),
}

type SecurityOutput = z.infer<typeof securitySchema>

export type PortfolioOutput = z.infer<z.ZodObject<typeof portfolioOutputSchema>>

export enum PresentMode {
  ONLY_NEW = 0,
  ONLY_INITIAL = 1,
  ONLY_DELTA = 2,
  WITH_DELTA = 3,
}

export class PortfolioMcpPresenter {
  public static present(
    portfolio: Portfolio,
    mode: PresentMode = PresentMode.ONLY_NEW,
  ): CallToolResult {
    const output = PortfolioMcpPresenter.getOutput(portfolio, mode)
    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    }
  }

  protected static getOutput(portfolio: Portfolio, mode: PresentMode): PortfolioOutput {
    const securities = PortfolioMcpPresenter.getSecurities(portfolio, mode)
    const { currency } = portfolio

    if (mode === PresentMode.ONLY_NEW) {
      return { currency, securities, portfolioPrice: portfolio.totalPrice.toNumber() }
    }
    if (mode === PresentMode.ONLY_INITIAL) {
      return { currency, securities, portfolioPrice: portfolio.initialTotalPrice.toNumber() }
    }
    if (mode === PresentMode.ONLY_DELTA) {
      return {
        currency,
        securities,
        tradedPrice: portfolio.totalTradedPrice.toNumber(),
        tradingFee: portfolio.totalTradingFee.toNumber(),
      }
    }
    if (mode === PresentMode.WITH_DELTA) {
      return {
        currency,
        securities,
        portfolioPrice: portfolio.totalPrice.toNumber(),
        tradedPrice: portfolio.totalTradedPrice.toNumber(),
        tradingFee: portfolio.totalTradingFee.toNumber(),
      }
    }
    throw Error(`Unknown present mode '${mode}'`)
  }

  protected static getSecurities(portfolio: Portfolio, mode: PresentMode): SecurityOutput[] {
    // Each trade's share of everything bought and sold, so buys and sells don't cancel out
    const grossTradedPrice = portfolio.securities.reduce(
      (acc, sec) => acc.plus(sec.tradedPrice.abs()),
      new Decimal(0),
    )

    return portfolio.securities
      .filter((sec) => (mode === PresentMode.ONLY_DELTA ? sec.isBeingTraded : true))
      .map((sec) => {
        const info = {
          tick: sec.tick,
          exchange: sec.exchange,
          currency: sec.currency,
          price: sec.price.toNumber(),
          targetPercent: roundPercentage(sec.targetPercentage.toNumber()),
        }

        if (mode === PresentMode.ONLY_INITIAL) {
          return {
            ...info,
            shares: sec.initialShares,
            totalPrice: sec.initialTotalPrice.toNumber(),
            percent: roundPercentage(
              sec.calcActualPercentage(portfolio.initialTotalPrice, sec.initialTotalPrice)
                .toNumber(),
            ),
          }
        }
        if (mode === PresentMode.ONLY_DELTA) {
          return {
            ...info,
            shares: sec.shares - sec.initialShares,
            totalPrice: sec.tradedPrice.toNumber(),
            percent: roundPercentage(
              sec.calcActualPercentage(grossTradedPrice, sec.tradedPrice.abs()).toNumber(),
            ),
            tradingFee: sec.tradingFee.toNumber(),
          }
        }

        const proposed = {
          ...info,
          shares: sec.shares,
          totalPrice: sec.totalPrice.toNumber(),
          percent: roundPercentage(sec.calcActualPercentage(portfolio.totalPrice).toNumber()),
        }
        if (mode === PresentMode.WITH_DELTA) {
          return {
            ...proposed,
            tradedShares: sec.shares - sec.initialShares,
            tradedPrice: sec.tradedPrice.toNumber(),
            tradingFee: sec.tradingFee.toNumber(),
          }
        }
        return proposed
      })
  }
}
