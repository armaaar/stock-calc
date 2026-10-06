import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import {
  FakePortfolioRepository, fakePortfolioRepository, useCasesOver,
} from '#src/__fixtures__/repository'
import { createMcpServer } from '../server'

type Holding = { tick: string, shares: number, tradedShares?: number, percent: number }

describe('MCP server', () => {
  let client: Client
  let repo: FakePortfolioRepository

  beforeEach(async () => {
    // The real use cases run against the example portfolio; only data loading is faked
    repo = fakePortfolioRepository()
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await createMcpServer(useCasesOver(repo)).connect(serverTransport)
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

    expect(repo.getPortfolio).toHaveBeenCalledWith('EUR')
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

    expect(repo.getPortfolio).toHaveBeenCalledWith('EGP')
    expect(output).toMatchObject({ portfolioPrice: 9015.85, tradedPrice: -39.15, tradingFee: 2 })
    expect(holdings(output.securities)).toEqual([
      { tick: 'QDVE', shares: 127, tradedShares: 27 },
      { tick: 'SPYD', shares: 87, tradedShares: -13 },
    ])
  })

  it('invest: balances for the current value plus the investment', async () => {
    const { output } = await callTool('invest', { investment: 1000 })

    expect(output).toMatchObject({
      portfolioPrice: 10035.15, tradedPrice: 980.15, cashAfterTrades: 17.85,
    })
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

  it('minimal: accepts the largest precision, 1', async () => {
    const { result } = await callTool('minimal', { precision: 1 })

    expect(result.isError).toBeFalsy()
  })

  it.each([
    ['target', { price: 0 }],
    ['target', { price: -5 }],
    ['target', { price: 'abc' }],
    ['invest', {}],
    ['invest', { investment: 'abc' }],
    ['invest', { investment: null }],
    ['minimal', { precision: 0 }],
    ['minimal', { precision: -0.01 }],
    ['minimal', { precision: 2 }],
    ['minimal', { sharesStep: 0 }],
    ['minimal', { sharesStep: 1.5 }],
    ['show', { portfolio: '' }],
    ['rebalance', { portfolio: 'EUR.old' }],
  ])('%s: rejects invalid input %j before running the use case', async (name, args) => {
    const { result } = await callTool(name, args)

    expect(result.isError).toBe(true)
    expect((result.content as { text: string }[])[0].text).toContain('Input validation error')
    expect(repo.getPortfolio).not.toHaveBeenCalled()
  })

  it.each(['show', 'rebalance', 'minimal', 'target', 'invest'])(
    '%s: rejects a portfolio name that could leave the data folder',
    async (name) => {
      const { result } = await callTool(name, { portfolio: '../EUR', price: 1, investment: 1 })

      expect(result.isError).toBe(true)
      expect((result.content as { text: string }[])[0].text)
        .toContain('Invalid portfolio name: use letters, digits, \'_\' or \'-\'')
      expect(repo.getPortfolio).not.toHaveBeenCalled()
    },
  )

  it('documents the input constraints in the tool schemas', async () => {
    const { tools } = await client.listTools()
    const schema = (name: string) => tools.find((tool) => tool.name === name)!.inputSchema
      .properties as Record<string, Record<string, unknown>>

    expect(schema('minimal').precision).toMatchObject({
      type: 'number', exclusiveMinimum: 0, maximum: 1, default: 0.01,
    })
    expect(schema('minimal').sharesStep).toMatchObject({ type: 'integer', minimum: 1, default: 1 })
    expect(schema('target').price).toMatchObject({ type: 'number', exclusiveMinimum: 0 })
    expect(schema('invest').investment).toMatchObject({ type: 'number' })
    expect(schema('show').portfolio).toMatchObject({
      type: 'string', pattern: '^[A-Za-z0-9_-]+$', default: 'EUR',
    })
  })

  it.each(['show', 'rebalance', 'minimal'])('%s: returns domain errors as tool errors', async (name) => {
    repo.getPortfolio.mockRejectedValue(Error('Portfolio \'NOPE\' not found'))

    const { result } = await callTool(name, { portfolio: 'NOPE' })

    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: 'Error: Portfolio \'NOPE\' not found' }])
  })

  it.each([
    ['target', { price: 100 }],
    ['invest', { investment: 100 }],
  ])('%s: returns domain errors as tool errors', async (name, args) => {
    repo.getPortfolio.mockRejectedValue(Error('boom'))

    const { result } = await callTool(name, args)

    expect(result.isError).toBe(true)
    expect(result.content).toEqual([{ type: 'text', text: 'Error: boom' }])
  })
})
