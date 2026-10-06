import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { PortfolioMcpPresenter, PresentMode, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerInvestTool(
  server: McpServer,
  invest: PortfolioUseCases['invest'],
): void {
  server.registerTool('invest', {
    title: 'Invest in portfolio',
    description: 'Calculates the number of shares you need to buy to satisfy your portfolio if you invest additionally. Also rebalances, so it may sell overweight securities, unless buyOnly is set. The plan stays within the investment plus the cash held, fees included; cashAfterTrades shows what is left (negative only when even selling everything cannot cover a withdrawal and its fees).',
    inputSchema: {
      // zod 4 numbers are finite: NaN and +/-Infinity are rejected
      investment: z.number()
        .describe('Additional investment, a finite number (negative to plan a withdrawal)'),
      buyOnly: z.boolean().optional()
        .describe('Only buy, never sell: spend the investment on the most underweight securities. '
          + 'The investment must then be at least 0. Default false'),
      ...portfolioInput,
    },
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ investment, buyOnly = false, portfolio: portfolioType }) => {
    try {
      const portfolio = await invest.execute({ portfolioType, investment, buyOnly })
      return PortfolioMcpPresenter.present(portfolio, PresentMode.WITH_DELTA)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
