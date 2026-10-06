import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerShowTool } from './McpTools/show.McpTool'
import { registerMinimalTool } from './McpTools/minimal.McpTool'
import { registerTargetTool } from './McpTools/target.McpTool'
import { registerRebalanceTool } from './McpTools/rebalance.McpTool'
import { registerInvestTool } from './McpTools/invest.McpTool'

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'stock-calc',
    title: 'Portfolio calculator',
    version: '0.1.0',
  }, {
    instructions: 'Tools to calculate shares in a stock portfolio. Every tool takes a `portfolio` '
      + 'name (default "EUR") that selects src/data/_settings.<portfolio>.jsonc. Results are '
      + 'plans only: nothing is traded and no file is changed. Percentages are in percent; '
      + 'negative traded shares or prices mean selling.',
  })

  registerShowTool(server)
  registerMinimalTool(server)
  registerTargetTool(server)
  registerRebalanceTool(server)
  registerInvestTool(server)

  return server
}
