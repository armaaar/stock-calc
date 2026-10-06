import { z } from 'zod'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import { PORTFOLIO_ID_PATTERN, PORTFOLIO_ID_RULE } from '#src/Shared/portfolioName'

export const portfolioInput = {
  portfolio: z.string()
    .regex(PORTFOLIO_ID_PATTERN, `Invalid portfolio: ${PORTFOLIO_ID_RULE}`)
    .optional()
    .describe('The portfolio to use, as <broker>/<portfolio> (e.g. ibkr/eur): the file '
      + '<broker>/<portfolio>.jsonc in the data folder. Leave it out when there is only one '
      + 'portfolio; otherwise the error lists them'),
}

// Every tool only reads local files and public quote pages, and returns a plan
export const portfolioToolAnnotations: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
}
