import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { connect, StdioServerTransport } = vi.hoisted(() => ({
  connect: vi.fn(),
  StdioServerTransport: vi.fn(),
}))

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({ StdioServerTransport }))
vi.mock('.././server', () => ({ createMcpServer: () => ({ connect }) }))

describe('MCP app entry point', () => {
  const original = { ...console }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    Object.assign(console, original)
  })

  it('connects the server over stdio', async () => {
    await import('.././app')

    expect(StdioServerTransport).toHaveBeenCalledOnce()
    expect(connect).toHaveBeenCalledWith(StdioServerTransport.mock.instances[0])
  })

  it('routes console output to stderr so stdout stays a clean JSON-RPC stream', async () => {
    const error = vi.fn()
    console.error = error

    await import('.././app')
    console.log('log')
    console.info('info')
    console.debug('debug')
    console.table([{ a: 1 }])

    expect(error.mock.calls).toEqual([['log'], ['info'], ['debug'], [[{ a: 1 }]]])
  })
})
