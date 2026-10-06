/**
 * A broker or portfolio name. Names select folders and files, so only letters, digits, '_' and
 * '-' are allowed, starting with a letter or digit ('_broker.jsonc' is reserved).
 */
const NAME = '[A-Za-z0-9][A-Za-z0-9_-]*'

/** A portfolio id: `<broker>/<portfolio>`, e.g. `ibkr/eur`. */
export const PORTFOLIO_ID_PATTERN = new RegExp(`^${NAME}/${NAME}$`)

export const NAME_PATTERN = new RegExp(`^${NAME}$`)

/** What a valid portfolio id looks like, for error messages. */
export const PORTFOLIO_ID_RULE = 'use <broker>/<portfolio>, each made of letters, digits, \'_\' '
  + 'or \'-\' and starting with a letter or digit'
