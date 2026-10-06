import type { z } from 'zod'
import type {
  SecurityPriceSchema, SettingsSchema, SettingsSecuritySchema,
} from './DataFiles.schema'

export type SettingsSecurityDto = z.infer<typeof SettingsSecuritySchema>

export type SettingsDto = z.infer<typeof SettingsSchema>

export type SecurityPriceDto = z.infer<typeof SecurityPriceSchema>

export interface IPriceDataDriver {
  getPrice(setting: SettingsSecurityDto): Promise<SecurityPriceDto>
}
