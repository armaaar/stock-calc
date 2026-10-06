import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { GetPortfolioWithInvestmentUseCase } from '@/UseCases/GetPortfolioWithInvestment.UseCase'
import { PortfolioMcpPresenter, PresentMode, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerInvestTool(server: McpServer): void {
  server.registerTool('invest', {
    title: 'Invest in portfolio',
    description: 'Calculates the number of shares you need to buy to satisfy your portfolio if you invest additionally. Also rebalances, so it may sell overweight securities.',
    inputSchema: {
      investment: z.number().describe('Additional investment'),
      ...portfolioInput,
    },
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ investment, portfolio: portfolioType }) => {
    try {
      const useCase = new GetPortfolioWithInvestmentUseCase(portfolioType, investment)
      const portfolio = await useCase.handler()
      return PortfolioMcpPresenter.present(portfolio, PresentMode.WITH_DELTA)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
