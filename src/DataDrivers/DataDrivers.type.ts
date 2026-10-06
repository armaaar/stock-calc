import type { z } from 'zod'
import type {
  BrokerSchema, OverridePriceSchema, SecurityPriceSchema, SettingsSchema, SettingsSecuritySchema,
} from './DataFiles.schema'

export type SettingsSecurityDto = z.infer<typeof SettingsSecuritySchema>

export type BrokerDto = z.infer<typeof BrokerSchema>

export type SettingsDto = z.infer<typeof SettingsSchema>

export type SecurityPriceDto = z.infer<typeof SecurityPriceSchema>

export type OverridePriceDto = z.infer<typeof OverridePriceSchema>

export type OverridesDto = Record<string, OverridePriceDto>

/** Finds portfolios (`<broker>/<portfolio>` ids) and reads their settings. */
export interface ISettingsDataDriver {
  /**
   * The id of the portfolio to load: the requested one if it exists, or the only portfolio in
   * the data folder when none is requested. Throws, listing the portfolios found, otherwise.
   */
  resolvePortfolioId(requested?: string): Promise<string>
  /** The portfolio's settings, with what it doesn't set taken from its broker's settings. */
  getPortfolioSettings(portfolioId: string): Promise<SettingsDto>
}

/** Reads a portfolio's price overrides file (`{}` when there is none). */
export interface IOverridesDataDriver {
  getPortfolioOverrides(portfolioId: string): Promise<OverridesDto>
}

/** A live price source. Its browser must be launched before `getPrice` and closed after. */
export interface IPriceDataDriver {
  /** Names the source on every price it gives, such as `justetf.com`. */
  readonly name: string
  launchBrowser(): Promise<void>
  closeBrowser(): Promise<void>
  getPrice(setting: SettingsSecurityDto): Promise<SecurityPriceDto>
}
