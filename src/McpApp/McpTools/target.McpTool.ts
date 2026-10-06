import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { GetPortfolioWithPriceUseCase } from '@/UseCases/GetPortfolioWithPrice.UseCase'
import { PortfolioMcpPresenter, PresentMode, portfolioOutputSchema } from '../Presenters/PortfolioMcp.Presenter'
import { ErrorMcpPresenter } from '../Presenters/ErrorMcp.Presenter'
import { portfolioInput, portfolioToolAnnotations } from '../mcpOptions'

export function registerTargetTool(server: McpServer): void {
  server.registerTool('target', {
    title: 'Target portfolio value',
    description: 'Calculates the number of shares you need to buy to satisfy your portfolio with a limited budget',
    inputSchema: {
      price: z.number().positive().describe('Target portfolio price'),
      ...portfolioInput,
    },
    outputSchema: portfolioOutputSchema,
    annotations: portfolioToolAnnotations,
  }, async ({ price, portfolio: portfolioType }) => {
    try {
      const useCase = new GetPortfolioWithPriceUseCase(portfolioType, price)
      const portfolio = await useCase.handler()
      return PortfolioMcpPresenter.present(portfolio, PresentMode.WITH_DELTA)
    } catch (e: unknown) {
      return ErrorMcpPresenter.present(e)
    }
  })
}
