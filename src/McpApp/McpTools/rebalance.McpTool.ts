import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { GetRebalancedPortfolioUseCase } from '@/UseCases/GetRebalancedPortfolio.UseCase'
import { PortfolioMcpPresenter, PresentMode, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerRebalanceTool(server: McpServer): void {
  server.registerTool('rebalance', {
    title: 'Rebalance portfolio',
    description: 'Rebalance the current portfolio',
    inputSchema: portfolioInput,
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ portfolio: portfolioType }) => {
    try {
      const useCase = new GetRebalancedPortfolioUseCase(portfolioType)
      const portfolio = await useCase.handler()
      return PortfolioMcpPresenter.present(portfolio, PresentMode.WITH_DELTA)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
