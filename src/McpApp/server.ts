import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { registerShowTool } from './McpTools/show.McpTool'
import { registerMinimalTool } from './McpTools/minimal.McpTool'
import { registerTargetTool } from './McpTools/target.McpTool'
import { registerRebalanceTool } from './McpTools/rebalance.McpTool'
import { registerInvestTool } from './McpTools/invest.McpTool'

export function createMcpServer(useCases: PortfolioUseCases): McpServer {
  const server = new McpServer({
    name: 'stock-calc',
    title: 'Portfolio calculator',
    version: '0.1.0',
  }, {
    instructions: 'Tools to calculate shares in a stock portfolio. Every tool takes a `portfolio` '
      + 'name (default "EUR") that selects _settings.<portfolio>.jsonc in the data folder '
      + '(STOCK_CALC_DATA_DIR, or src/data in the repository). Results are '
      + 'plans only: nothing is traded and no file is changed. Percentages are in percent; '
      + 'negative traded shares or prices mean selling.',
  })

  registerShowTool(server, useCases.show)
  registerMinimalTool(server, useCases.minimal)
  registerTargetTool(server, useCases.target)
  registerRebalanceTool(server, useCases.rebalance)
  registerInvestTool(server, useCases.invest)

  return server
}
