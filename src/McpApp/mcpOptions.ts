import { z } from 'zod'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'

export const portfolioInput = {
  portfolio: z.string()
    .default('EUR')
    .describe('The portfolio to use: selects src/data/_settings.<portfolio>.jsonc'),
}

// Every tool only reads local files and public quote pages, and returns a plan
export const portfolioToolAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
}
