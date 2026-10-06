import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DEFAULT_ACCEPTABLE_PRECESION, DEFAULT_SHARES_STEP, GetPortfolioWithMinimumSharesUseCase } from '@/UseCases/GetPortfolioWithMinimumShares.UseCase'
import { PortfolioMcpPresenter, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerMinimalTool(server: McpServer): void {
  server.registerTool('minimal', {
    title: 'Minimal portfolio',
    description: 'Calculates the minimum number of shares you need to buy to satisfy your portfolio',
    inputSchema: {
      precision: z.number().min(0).max(1)
        .default(DEFAULT_ACCEPTABLE_PRECESION)
        .describe('How much can your securities percentage deviate from target (0.01 = 1 percentage point)'),
      sharesStep: z.number().int().min(1)
        .default(DEFAULT_SHARES_STEP)
        .describe('The minimum amount of shares a security is incremented by'),
      ...portfolioInput,
    },
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ precision, sharesStep, portfolio: portfolioType }) => {
    try {
      const useCase = new GetPortfolioWithMinimumSharesUseCase(
        portfolioType,
        precision,
        sharesStep,
      )
      const portfolio = await useCase.handler()
      return PortfolioMcpPresenter.present(portfolio)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
