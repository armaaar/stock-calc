import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { DEFAULT_ACCEPTABLE_PRECESION, DEFAULT_SHARES_STEP } from '#src/UseCases/GetPortfolioWithMinimumShares.UseCase'
import { PortfolioMcpPresenter, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerMinimalTool(
  server: McpServer,
  minimal: PortfolioUseCases['minimal'],
): void {
  server.registerTool('minimal', {
    title: 'Minimal portfolio',
    description: 'Calculates the minimum number of shares you need to buy to satisfy your portfolio',
    inputSchema: {
      precision: z.number().positive().max(1)
        .default(DEFAULT_ACCEPTABLE_PRECESION)
        .describe('How much can your securities percentage deviate from target, greater than 0 and at most 1 (0.01 = 1 percentage point)'),
      sharesStep: z.number().int().min(1)
        .default(DEFAULT_SHARES_STEP)
        .describe('The minimum amount of shares a security is incremented by (an integer, at least 1)'),
      ...portfolioInput,
    },
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ precision, sharesStep, portfolio: portfolioType }) => {
    try {
      const portfolio = await minimal.execute({
        portfolioType,
        acceptablePrecision: precision,
        sharesStep,
      })
      return PortfolioMcpPresenter.present(portfolio)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
