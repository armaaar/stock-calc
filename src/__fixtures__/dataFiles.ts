import type {
  SecurityPriceDto, SettingsDto, SettingsSecurityDto,
} from '#src/DataDrivers/IPriceDataDriver.type'
import { QDVE, SPYD } from './portfolio'

/**
 * DTO counterparts of the shared QDVE / SPYD fixtures, i.e. what the settings and overrides
 * data drivers return for `src/data/_settings.EUR.jsonc.example` and
 * `_overrides.EUR.jsonc.example`.
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

export const EUR_OVERRIDES: Record<string, SecurityPriceDto> = {
  QDVE: { price: QDVE.price, currency: QDVE.currency as string },
  SPYD: { price: SPYD.price, currency: SPYD.currency as string },
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
