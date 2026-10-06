import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { PortfolioMcpPresenter, PresentMode, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerRebalanceTool(
  server: McpServer,
  rebalance: PortfolioUseCases['rebalance'],
): void {
  server.registerTool('rebalance', {
    title: 'Rebalance portfolio',
    description: 'Rebalance the current portfolio',
    inputSchema: portfolioInput,
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ portfolio: portfolioId }) => {
    try {
      const portfolio = await rebalance.execute({ portfolio: portfolioId })
      return PortfolioMcpPresenter.present(portfolio, PresentMode.WITH_DELTA)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
