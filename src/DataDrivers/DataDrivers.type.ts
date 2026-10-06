import type { z } from 'zod'
import type {
  SecurityPriceSchema, SettingsSchema, SettingsSecuritySchema,
} from './DataFiles.schema'

export type SettingsSecurityDto = z.infer<typeof SettingsSecuritySchema>

export type SettingsDto = z.infer<typeof SettingsSchema>

export type SecurityPriceDto = z.infer<typeof SecurityPriceSchema>

export type OverridesDto = Record<string, SecurityPriceDto>

/** Reads a portfolio's settings file. */
export interface ISettingsDataDriver {
  getPortfolioSettings(type: string): Promise<SettingsDto>
}

/** Reads a portfolio's price overrides file (`{}` when there is none). */
export interface IOverridesDataDriver {
  getPortfolioOverrides(type: string): Promise<OverridesDto>
}

/** A live price source. Its browser must be launched before `getPrice` and closed after. */
export interface IPriceDataDriver {
  launchBrowser(): Promise<void>
  closeBrowser(): Promise<void>
  getPrice(setting: SettingsSecurityDto): Promise<SecurityPriceDto>
}
