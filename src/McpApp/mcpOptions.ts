import { z } from 'zod'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import { PORTFOLIO_NAME_PATTERN } from '@/Shared/portfolioName'

export const portfolioInput = {
  portfolio: z.string()
    .regex(PORTFOLIO_NAME_PATTERN, 'Invalid portfolio name: use letters, digits, \'_\' or \'-\'')
    .default('EUR')
    .describe('The portfolio to use: selects src/data/_settings.<portfolio>.jsonc. '
      + 'Letters, digits, \'_\' or \'-\' only'),
}

// Every tool only reads local files and public quote pages, and returns a plan
export const portfolioToolAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
}
