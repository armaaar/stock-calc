import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { PortfolioMcpPresenter, PresentMode, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerShowTool(
  server: McpServer,
  show: PortfolioUseCases['show'],
): void {
  server.registerTool('show', {
    title: 'Show portfolio',
    description: 'Show information about the current portfolio: holdings, prices, value, and actual vs target weights',
    inputSchema: portfolioInput,
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ portfolio: portfolioType }) => {
    try {
      const portfolio = await show.execute({ portfolioType })
      return PortfolioMcpPresenter.present(portfolio, PresentMode.ONLY_INITIAL)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
