import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { GetCurrentPortfolioUseCase } from '@/UseCases/GetCurrentPortfolio.UseCase'
import { PortfolioMcpPresenter, PresentMode, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerShowTool(server: McpServer): void {
  server.registerTool('show', {
    title: 'Show portfolio',
    description: 'Show information about the current portfolio: holdings, prices, value, and actual vs target weights',
    inputSchema: portfolioInput,
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ portfolio: portfolioType }) => {
    try {
      const useCase = new GetCurrentPortfolioUseCase(portfolioType)
      const portfolio = await useCase.handler()
      return PortfolioMcpPresenter.present(portfolio, PresentMode.ONLY_INITIAL)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
