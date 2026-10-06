/* eslint-disable no-console */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './server'

// stdout carries the JSON-RPC stream: route anything else that logs to stderr
console.log = console.error
console.info = console.error
console.debug = console.error
console.table = (data: unknown) => console.error(data)

const server = createMcpServer()
await server.connect(new StdioServerTransport())
