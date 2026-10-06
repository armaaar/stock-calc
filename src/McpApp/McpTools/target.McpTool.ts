import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { PortfolioMcpPresenter, PresentMode, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerTargetTool(
  server: McpServer,
  target: PortfolioUseCases['target'],
): void {
  server.registerTool('target', {
    title: 'Target portfolio value',
    description: 'Calculates the number of shares you need to buy to satisfy your portfolio with a limited budget',
    inputSchema: {
      price: z.number().positive().describe('Target portfolio price'),
      ...portfolioInput,
    },
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ price, portfolio: portfolioId }) => {
    try {
      const portfolio = await target.execute({ portfolio: portfolioId, targetPrice: price })
      return PortfolioMcpPresenter.present(portfolio, PresentMode.WITH_DELTA)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
