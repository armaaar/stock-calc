import fs from 'fs'
import path from 'path'
import { parse } from 'jsonc-parser'
import { describe, expect, it } from 'vitest'
import { EUR_OVERRIDES, EUR_SETTINGS, withoutIsin } from '@/__fixtures__/dataFiles'
import {
  OverridesSchema, parseDataFile, SecurityPriceSchema, SettingsSchema, SettingsSecuritySchema,
} from '.././DataFiles.schema'

const FILE = '/data/_settings.TEST.jsonc'

describe('parseDataFile', () => {
  it('returns the parsed data when it matches the schema', () => {
    expect(parseDataFile(SettingsSchema, EUR_SETTINGS, FILE)).toEqual(EUR_SETTINGS)
  })

  it('throws an "Invalid data file" error naming the file, the problem and the field path', () => {
    const data = {
      ...EUR_SETTINGS,
      securities: [{ ...EUR_SETTINGS.securities[0], shares: '100' }],
    }

    expect(() => parseDataFile(SettingsSchema, data, FILE)).toThrow(
      `Invalid data file '${FILE}':\n`,
    )
    expect(() => parseDataFile(SettingsSchema, data, FILE))
      .toThrow(/expected number, received string[\s\S]*securities\[0\]\.shares/)
  })

  it('reports every invalid field', () => {
    let message = ''
    try {
      parseDataFile(SettingsSchema, { securities: 'none' }, FILE)
    } catch (e) {
      message = (e as Error).message
    }

    expect(message).toContain('brokerageFeeFlat')
    expect(message).toContain('tradingFeePercentage')
    expect(message).toContain('minimumTradingFeeFlat')
    expect(message).toContain('securities')
  })

  it('rejects data that is not an object at all (e.g. an empty file)', () => {
    expect(() => parseDataFile(SettingsSchema, undefined, FILE)).toThrow(/Invalid data file/)
  })
})

describe('SettingsSecuritySchema', () => {
  it('accepts a security without an isin', () => {
    const noIsin = withoutIsin(EUR_SETTINGS.securities[0])

    expect(SettingsSecuritySchema.parse(noIsin)).toEqual(noIsin)
  })

  it.each(['tick', 'exchange', 'shares', 'targetPercentage'])('requires %s', (field) => {
    const security: Record<string, unknown> = { ...EUR_SETTINGS.securities[0] }
    delete security[field]

    const result = SettingsSecuritySchema.safeParse(security)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual([field])
  })

  it('strips unknown keys', () => {
    const parsed = SettingsSecuritySchema.parse({ ...EUR_SETTINGS.securities[0], note: 'x' })

    expect(parsed).not.toHaveProperty('note')
  })

  // Current behaviour: no range checks; negative shares and percentages pass the file schema
  // and are only caught later (if at all) by the entity validators.
  it('does not range-check numbers', () => {
    const security = { ...EUR_SETTINGS.securities[0], shares: -1, targetPercentage: 7 }

    expect(SettingsSecuritySchema.safeParse(security).success).toBe(true)
  })
})

describe('OverridesSchema', () => {
  it('accepts a tick → price map', () => {
    expect(OverridesSchema.parse(EUR_OVERRIDES)).toEqual(EUR_OVERRIDES)
  })

  it('accepts an empty map', () => {
    expect(OverridesSchema.parse({})).toEqual({})
  })

  it('rejects an entry with a missing currency, reporting the tick in the path', () => {
    const result = OverridesSchema.safeParse({ QDVE: { price: 1 } })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['QDVE', 'currency'])
  })

  it('rejects a string price', () => {
    expect(SecurityPriceSchema.safeParse({ price: '1', currency: 'EUR' }).success).toBe(false)
  })
})

describe('tracked example data files', () => {
  const dataDir = path.resolve(import.meta.dirname, '../../data')
  const read = (name: string) => parse(fs.readFileSync(path.join(dataDir, name)).toString())

  it('_settings.EUR.jsonc.example matches SettingsSchema', () => {
    const file = '_settings.EUR.jsonc.example'

    expect(parseDataFile(SettingsSchema, read(file), file)).toEqual(EUR_SETTINGS)
  })

  it('_overrides.EUR.jsonc.example matches OverridesSchema', () => {
    const file = '_overrides.EUR.jsonc.example'

    expect(parseDataFile(OverridesSchema, read(file), file)).toEqual(EUR_OVERRIDES)
  })
})
