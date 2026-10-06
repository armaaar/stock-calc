import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { EUR_OVERRIDES, EUR_SETTINGS, withoutIsin } from '#src/__fixtures__/dataFiles'
import {
  OverridesSchema, parseDataFile, SecurityPriceSchema, SettingsSchema, SettingsSecuritySchema,
} from '../DataFiles.schema'
import { parseJsonc } from '../DataFiles.reader'

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

  it.each(['note', 'brokerageFee', 'tradingFeePercent'])('rejects the unknown key %s', (key) => {
    const result = SettingsSecuritySchema.safeParse({ ...EUR_SETTINGS.securities[0], [key]: 1 })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({ code: 'unrecognized_keys', keys: [key] })
  })

  it.each([
    ['tick', ''],
    ['tick', '   '],
    ['exchange', ''],
    ['shares', -1],
    ['shares', 1.5],
    ['targetPercentage', -0.1],
    ['targetPercentage', 1.01],
    ['targetPercentage', 40],
  ])('rejects %s = %j', (field, value) => {
    const security = { ...EUR_SETTINGS.securities[0], [field]: value }

    const result = SettingsSecuritySchema.safeParse(security)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual([field])
  })

  it.each([
    ['shares', 0],
    ['targetPercentage', 0],
    ['targetPercentage', 1],
  ])('accepts the boundary %s = %j', (field, value) => {
    const security = { ...EUR_SETTINGS.securities[0], [field]: value }

    expect(SettingsSecuritySchema.safeParse(security).success).toBe(true)
  })

  it.each([
    ['brokerageFeeFlat', -1],
    ['minimumTradingFeeFlat', -0.01],
    ['tradingFeePercentage', -0.001],
    ['tradingFeePercentage', 1.5],
    ['brokerageFeeFlat', '3'],
  ])('rejects a fee override %s = %j', (field, value) => {
    const security = { ...EUR_SETTINGS.securities[0], [field]: value }

    const result = SettingsSecuritySchema.safeParse(security)

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual([field])
  })

  it('accepts any subset of the fee parts as overrides', () => {
    const security = {
      ...EUR_SETTINGS.securities[0], brokerageFeeFlat: 3.56, tradingFeePercentage: 0,
    }

    expect(SettingsSecuritySchema.parse(security)).toEqual(security)
  })

  it('leaves the fee parts a security does not set undefined, so they fall back', () => {
    const parsed = SettingsSecuritySchema.parse(EUR_SETTINGS.securities[0])

    expect(parsed.brokerageFeeFlat).toBeUndefined()
    expect(parsed.tradingFeePercentage).toBeUndefined()
    expect(parsed.minimumTradingFeeFlat).toBeUndefined()
  })

  it('trims tick and exchange', () => {
    const parsed = SettingsSecuritySchema.parse({
      ...EUR_SETTINGS.securities[0], tick: ' QDVE ', exchange: ' IBIS2',
    })

    expect(parsed).toMatchObject({ tick: 'QDVE', exchange: 'IBIS2' })
  })
})

describe('SettingsSchema', () => {
  it.each([
    ['brokerageFeeFlat', -1],
    ['minimumTradingFeeFlat', -0.01],
    ['tradingFeePercentage', -0.001],
    ['tradingFeePercentage', 1.5],
  ])('rejects %s = %j', (field, value) => {
    const result = SettingsSchema.safeParse({ ...EUR_SETTINGS, [field]: value })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual([field])
  })

  it.each([
    ['brokerageFeeFlat', 0],
    ['minimumTradingFeeFlat', 0],
    ['tradingFeePercentage', 0],
    ['tradingFeePercentage', 1],
  ])('accepts the boundary %s = %j', (field, value) => {
    expect(SettingsSchema.safeParse({ ...EUR_SETTINGS, [field]: value }).success).toBe(true)
  })

  it('accepts optional cash of at least 0', () => {
    expect(SettingsSchema.parse({ ...EUR_SETTINGS, cash: 0 }).cash).toBe(0)
    expect(SettingsSchema.parse({ ...EUR_SETTINGS, cash: 120.5 }).cash).toBe(120.5)
    expect(SettingsSchema.parse(EUR_SETTINGS).cash).toBeUndefined()
  })

  it.each([-0.01, '100'])('rejects cash = %j', (cash) => {
    const result = SettingsSchema.safeParse({ ...EUR_SETTINGS, cash })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['cash'])
  })

  it('rejects an unknown top-level key, such as a misspelled fee', () => {
    const result = SettingsSchema.safeParse({ ...EUR_SETTINGS, brokerageFeeFlt: 1 })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      code: 'unrecognized_keys', keys: ['brokerageFeeFlt'],
    })
  })

  it('names the misspelled key and its security in the file error', () => {
    const data = {
      ...EUR_SETTINGS,
      securities: [EUR_SETTINGS.securities[0], { ...EUR_SETTINGS.securities[1], brokerFee: 3 }],
    }

    expect(() => parseDataFile(SettingsSchema, data, FILE))
      .toThrow(/brokerFee[\s\S]*securities\[1\]/)
  })

  it('reports a range error with the file path and the field path', () => {
    const data = {
      ...EUR_SETTINGS,
      securities: [{ ...EUR_SETTINGS.securities[0], targetPercentage: 40 }],
    }

    expect(() => parseDataFile(SettingsSchema, data, FILE))
      .toThrow(/^Invalid data file '\/data\/_settings\.TEST\.jsonc':\n[\s\S]*<=1[\s\S]*securities\[0\]\.targetPercentage/)
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

  it.each([0, -1])('rejects the price %j', (price) => {
    const result = OverridesSchema.safeParse({ QDVE: { price, currency: 'EUR' } })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['QDVE', 'price'])
  })

  it.each(['', ' '])('rejects the currency %j', (currency) => {
    const result = OverridesSchema.safeParse({ QDVE: { price: 1, currency } })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['QDVE', 'currency'])
  })
})

describe('tracked example data files', () => {
  const dataDir = path.resolve(import.meta.dirname, '../../data')
  // parseJsonc also rejects JSONC syntax errors, like the data drivers do
  const read = (name: string) => parseJsonc(
    fs.readFileSync(path.join(dataDir, name)).toString(),
    name,
  )

  it('_settings.EUR.jsonc.example matches SettingsSchema', () => {
    const file = '_settings.EUR.jsonc.example'

    expect(parseDataFile(SettingsSchema, read(file), file)).toEqual(EUR_SETTINGS)
  })

  it('_overrides.EUR.jsonc.example matches OverridesSchema', () => {
    const file = '_overrides.EUR.jsonc.example'

    expect(parseDataFile(OverridesSchema, read(file), file)).toEqual(EUR_OVERRIDES)
  })

  it('_settings.EGP.jsonc.example matches SettingsSchema', () => {
    const file = '_settings.EGP.jsonc.example'

    const settings = parseDataFile(SettingsSchema, read(file), file)

    // It also shows a per-security fee override
    expect(settings.securities.map((sec) => sec.minimumTradingFeeFlat)).toEqual([undefined, 5])
  })

  it('_overrides.EGP.jsonc.example matches OverridesSchema', () => {
    const file = '_overrides.EGP.jsonc.example'

    expect(() => parseDataFile(OverridesSchema, read(file), file)).not.toThrow()
  })
})
