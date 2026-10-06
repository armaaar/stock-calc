import fs from 'fs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { createDataDir, exampleFiles } from '#src/__fixtures__/dataFiles'

const { clientEnds } = vi.hoisted(() => ({ clientEnds: [] as Transport[] }))

// stdio is the process boundary: each "stdio" transport is the server end of an in-memory pair
vi.mock('@modelcontextprotocol/sdk/server/stdio.js', async () => {
  const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
  return {
    StdioServerTransport: class {
      constructor() {
        const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair()
        clientEnds.push(clientEnd)
        return serverEnd
      }
    },
  }
})

/** A data folder holding the tracked example broker: every price is overridden. */
function createTmpDataDir(): string {
  return createDataDir(exampleFiles())
}

type Holding = { tick: string, shares: number, tradedShares?: number }

describe('MCP app entry point', () => {
  const original = { ...console }
  let dataDir: string
  let client: Client | undefined

  beforeAll(() => {
    dataDir = createTmpDataDir()
  })

  afterAll(() => {
    fs.rmSync(dataDir, { recursive: true })
  })

  beforeEach(() => {
    clientEnds.length = 0
    vi.stubEnv('STOCK_CALC_DATA_DIR', dataDir)
    vi.resetModules()
  })

  afterEach(async () => {
    await client?.close()
    client = undefined
    vi.unstubAllEnvs()
    Object.assign(console, original)
  })

  /** Imports the entry point and connects an SDK client to the transport it opened. */
  async function startApp(): Promise<Client> {
    await import('../app')
    expect(clientEnds).toHaveLength(1)
    client = new Client({ name: 'test-client', version: '0.0.0' })
    await client.connect(clientEnds[0])
    return client
  }

  it('serves every tool over stdio', async () => {
    const { tools } = await (await startApp()).listTools()

    expect(tools.map((tool) => tool.name)).toEqual(['show', 'minimal', 'target', 'rebalance', 'invest'])
  })

  it('runs the tools against the data folder, end to end', async () => {
    const result = await (await startApp()).callTool({
      name: 'invest',
      arguments: { investment: 1000, portfolio: 'ibkr/eur' },
    })

    expect(result.isError).toBeFalsy()
    const output = result.structuredContent as { portfolioPrice: number, securities: Holding[] }
    expect(output.portfolioPrice).toBe(10035.15)
    const holdings = output.securities
      .map(({ tick, shares, tradedShares }) => ({ tick, shares, tradedShares }))
    expect(holdings).toEqual([
      { tick: 'QDVE', shares: 141, tradedShares: 41 },
      { tick: 'SPYD', shares: 97, tradedShares: -3 },
    ])
  })

  it('routes console output to stderr so stdout stays a clean JSON-RPC stream', async () => {
    const error = vi.fn()
    console.error = error

    await import('../app')
    console.log('log')
    console.info('info')
    console.debug('debug')
    console.table([{ a: 1 }])

    expect(error.mock.calls).toEqual([['log'], ['info'], ['debug'], [[{ a: 1 }]]])
  })
})
