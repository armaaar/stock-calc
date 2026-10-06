import fs from 'fs'
import os from 'os'
import path from 'path'
import type {
  OverridesDto, SettingsDto, SettingsSecurityDto,
} from '#src/DataDrivers/DataDrivers.type'
import { QDVE, SPYD } from './portfolio'

/**
 * DTO counterparts of the shared QDVE / SPYD fixtures, i.e. what the settings and overrides
 * data drivers return for the tracked `examples/ibkr/eur.jsonc` (with its broker's fees, except
 * the FX fee) and `eur.overrides.jsonc`.
 */
export const QDVE_SETTING: SettingsSecurityDto = {
  tick: QDVE.tick,
  exchange: QDVE.exchange as string,
  isin: QDVE.isin,
  shares: QDVE.shares,
  targetPercentage: QDVE.targetPercentage,
}

export const SPYD_SETTING: SettingsSecurityDto = {
  tick: SPYD.tick,
  exchange: SPYD.exchange as string,
  isin: SPYD.isin,
  shares: SPYD.shares,
  targetPercentage: SPYD.targetPercentage,
}

/** A copy of a setting without its `isin`. */
export function withoutIsin(setting: SettingsSecurityDto): SettingsSecurityDto {
  const copy = { ...setting }
  delete copy.isin
  return copy
}

export const EUR_SETTINGS: SettingsDto = {
  brokerageFeeFlat: 1,
  tradingFeePercentage: 0,
  minimumTradingFeeFlat: 0,
  securities: [QDVE_SETTING, SPYD_SETTING],
}

export const EUR_OVERRIDES: OverridesDto = {
  prices: {
    QDVE: { price: QDVE.price, currency: QDVE.currency as string },
    SPYD: { price: SPYD.price, currency: SPYD.currency as string },
  },
  rates: {},
}

/** Overrides of these prices only, and of no exchange rate. */
export function priceOverrides(prices: OverridesDto['prices']): OverridesDto {
  return { prices, rates: {} }
}

/** The JSONC text of `EUR_SETTINGS`, with comments in the places users put them. */
export const EUR_SETTINGS_JSONC = `{
  // Fees
  "brokerageFeeFlat": 1,
  "tradingFeePercentage": 0,
  "minimumTradingFeeFlat": 0,
  "securities": [
    /* block comment */
    { "tick": "QDVE", "exchange": "IBIS2", "isin": "IE00B3WJKG14", "shares": 100, "targetPercentage": 0.4 },
    { "tick": "SPYD", "exchange": "IBIS2", "isin": "IE00B6YX5D40", "shares": 100, "targetPercentage": 0.6 }
  ]
}
`

/** The JSONC text of `EUR_OVERRIDES`. */
export const EUR_OVERRIDES_JSONC = `{
  // Keyed by tick
  "QDVE": { "price": 28.45, "currency": "EUR" },
  /* block comment */
  "SPYD": { "price": 62.10, "currency": "EUR" }
}
`

/** The tracked examples folder: a data folder with an `ibkr` and a `thndr` broker. */
export const EXAMPLES_DIR = path.resolve(import.meta.dirname, '../../examples')

/**
 * The example brokers' files, keyed by their path in a data folder (`ibkr/eur.jsonc`), for
 * `createDataDir`. Every price in them is overridden, so they load without a browser.
 */
export function exampleFiles(): Record<string, string> {
  const brokers = fs.readdirSync(EXAMPLES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
  return Object.fromEntries(brokers.flatMap((broker) => (
    fs.readdirSync(path.join(EXAMPLES_DIR, broker.name)).map((name) => [
      `${broker.name}/${name}`,
      fs.readFileSync(path.join(EXAMPLES_DIR, broker.name, name), 'utf8'),
    ])
  )))
}

/**
 * A fresh temporary data folder holding the given files (path → content), for the file data
 * drivers. Tests never write to `src/data`. Remove it with `fs.rmSync(dir, { recursive: true })`.
 */
export function createDataDir(files: Record<string, string> = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stock-calc-'))
  for (const [name, content] of Object.entries(files)) {
    // Names may include folders, such as 'ibkr/eur.jsonc'
    const file = path.join(dir, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, content)
  }
  return dir
}
