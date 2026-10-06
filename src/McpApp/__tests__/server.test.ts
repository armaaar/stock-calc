import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildPortfolio } from '@/__fixtures__/portfolio'
import { createMcpServer } from '.././server'

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }))

// The real use cases run against the example portfolio; only data loading is faked
vi.mock('@/Repositories/Portfolio.Repository', () => ({
  PortfolioRepository: class {
    getPortfolio = getPortfolio
  },
}))

type Holding = { tick: string, shares: number, tradedShares?: number, percent: number }

describe('MCP server', () => {
  let client: Client

  beforeEach(async () => {
    getPortfolio.mockImplementation(async () => buildPortfolio())
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await createMcpServer().connect(serverTransport)
    client = new Client({ name: 'test-client', version: '0.0.0' })
    await client.connect(clientTransport)
  })

  afterEach(async () => {
    await client.close()
  })

  async function callTool(name: string, args: Record<string, unknown> = {}) {
    const result = await client.callTool({ name, arguments: args })
    const output = result.structuredContent as Record<string, unknown> & { securities: Holding[] }
    return { result, output }
  }

  function holdings(securities: Holding[]) {
    return securities.map(({ tick, shares, tradedShares }) => ({ tick, shares, tradedShares }))
  }

  it('describes itself and gives usage instructions', () => {
    expect(client.getServerVersion()).toMatchObject({ name: 'stock-calc', version: '0.1.0' })
    expect(client.getInstructions()).toContain('portfolio')
  })

  it('exposes one read-only tool per CLI command, with output schemas', async () => {
    const { tools } = await client.listTools()

    expect(tools.map((tool) => tool.name)).toEqual(['show', 'minimal', 'target', 'rebalance', 'invest'])
    for (const tool of tools) {
      expect(tool.inputSchema.properties).toHaveProperty('portfolio')
      expect(tool.outputSchema).toBeDefined()
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    }
  })

  it('show: returns current holdings for the default EUR portfolio', async () => {
    const { result, output } = await callTool('show')

    expect(getPortfolio).toHaveBeenCalledWith('EUR')
    expect(result.isError).toBeFalsy()
    expect(output).toMatchObject({ currency: 'EUR', portfolioPrice: 9055 })
    expect(output.securities.map(({ tick, shares, percent }) => ({ tick, shares, percent })))
      .toEqual([
        { tick: 'QDVE', shares: 100, percent: 31.42 },
        { tick: 'SPYD', shares: 100, percent: 68.58 },
      ])
    expect(JSON.parse((result.content as { text: string }[])[0].text)).toEqual(output)
  })

  it('rebalance: returns proposed holdings with trades and fees', async () => {
    const { output } = await callTool('rebalance', { portfolio: 'EGP' })

    expect(getPortfolio).toHaveBeenCalledWith('EGP')
    expect(output).toMatchObject({ portfolioPrice: 9015.85, tradedPrice: -39.15, tradingFee: 2 })
    expect(holdings(output.securities)).toEqual([
      { tick: 'QDVE', shares: 127, tradedShares: 27 },
      { tick: 'SPYD', shares: 87, tradedShares: -13 },
    ])
  })

  it('invest: balances for the current value plus the investment', async () => {
    const { output } = await callTool('invest', { investment: 1000 })

    expect(output).toMatchObject({ portfolioPrice: 10035.15, tradedPrice: 980.15 })
    expect(holdings(output.securities)).toEqual([
      { tick: 'QDVE', shares: 141, tradedShares: 41 },
      { tick: 'SPYD', shares: 97, tradedShares: -3 },
    ])
  })

  it('target: balances for an absolute portfolio value', async () => {
    const { output } = await callTool('target', { price: 5000 })

    expect(output).toMatchObject({ portfolioPrice: 4972.3, tradedPrice: -4082.7 })
    expect(holdings(output.securities)).toEqual([
      { tick: 'QDVE', shares: 70, tradedShares: -30 },
      { tick: 'SPYD', shares: 48, tradedShares: -52 },
    ])
  })

  it('minimal: uses the CLI defaults when precision and shares step are omitted', async () => {
    const { output } = await callTool('minimal')

    expect(output.portfolioPrice).toBe(209.55)
    expect(holdings(output.securities)).toEqual([
      { tick: 'QDVE', shares: 3, tradedShares: undefined },
      { tick: 'SPYD', shares: 2, tradedShares: undefined },
    ])
  })

  it('minimal: honours precision and shares step', async () => {
    const precise = await callTool('minimal', { precision: 0.001 })
    expect(holdings(precise.output.securities).map(({ shares }) => shares)).toEqual([16, 11])

    const stepped = await callTool('minimal', { sharesStep: 2 })
    for (const { shares } of stepped.output.securities) {
      expect(shares % 2).toBe(0)
    }
  })

  it.each([
    ['target', { price: 0 }],
    ['target', { price: 'abc' }],
    ['invest', {}],
    ['minimal', { precision: 2 }],
    ['minimal', { sharesStep: 1.5 }],
  ])('%s: rejects invalid input %j before running the use case', async (name, args) => {
    const { result } = await callTool(name, args)

    expect(result.isError).toBe(true)
    expect((result.content as { text: string }[])[0].text).toContain('Input validation error')
    expect(getPortfolio).not.toHaveBeenCalled()
  })

  it.each(['show', 'rebalance', 'minimal'])('%s: returns domain errors as tool errors', async (name) => {
    getPortfolio.mockRejectedValue(Error('Portfolio \'NOPE\' not found'))

    const { result } = await callTool(name, { portfolio: 'NOPE' })

    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: 'Error: Portfolio \'NOPE\' not found' }])
  })

  it.each([
    ['target', { price: 100 }],
    ['invest', { investment: 100 }],
  ])('%s: returns domain errors as tool errors', async (name, args) => {
    getPortfolio.mockRejectedValue(Error('boom'))

    const { result } = await callTool(name, args)

    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: 'Error: boom' }])
  })
})
