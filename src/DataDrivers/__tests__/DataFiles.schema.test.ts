import { describe, expect, it } from 'vitest'
import {
  EUR_OVERRIDES, EUR_SETTINGS, EXAMPLES_DIR, withoutIsin,
} from '#src/__fixtures__/dataFiles'
import {
  BrokerSchema, OverridesSchema, parseDataFile, SecurityPriceSchema, SettingsSchema,
  SettingsSecuritySchema,
} from '../DataFiles.schema'
import { listPortfolioIds } from '../DataFiles.reader'
import { OverridesDataDriver } from '../Overrides.DataDriver'
import { SettingsDataDriver } from '../Settings.DataDriver'

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
      parseDataFile(SettingsSchema, {
        brokerageFeeFlat: '1', tradingFeePercentage: 2, cash: -1, securities: 'none',
      }, FILE)
    } catch (e) {
      message = (e as Error).message
    }

    expect(message).toContain('brokerageFeeFlat')
    expect(message).toContain('tradingFeePercentage')
    expect(message).toContain('cash')
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
  it('needs only the securities: every fee part is optional', () => {
    expect(SettingsSchema.parse({ securities: [] })).toEqual({ securities: [] })
  })

  it('accepts the currency orders are paid in, and an FX fee percentage', () => {
    const settings = SettingsSchema.parse({ currency: 'EUR', fxFeePercentage: 0.0003, securities: [] })

    expect(settings).toEqual({ currency: 'EUR', fxFeePercentage: 0.0003, securities: [] })
  })

  it.each(['eur', 'EURO', 'E', ''])('rejects the currency %j', (currency) => {
    const result = SettingsSchema.safeParse({ currency, securities: [] })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['currency'])
    expect(result.error?.issues[0].message).toBe('Must be a 3-letter currency code, such as EUR')
  })

  it.each([-0.01, 1.5])('rejects the FX fee percentage %j', (fxFeePercentage) => {
    expect(SettingsSchema.safeParse({ fxFeePercentage, securities: [] }).success).toBe(false)
    expect(BrokerSchema.safeParse({ fxFeePercentage }).success).toBe(false)
  })

  it('accepts the snduk.com page of a fund', () => {
    const security = { ...EUR_SETTINGS.securities[0], snduk: 'azimut-usd-az-30-Fund' }

    expect(SettingsSecuritySchema.parse(security).snduk).toBe('azimut-usd-az-30-Fund')
  })

  it.each(['', '-fund', 'beltone/../x', 'beltone meya', 'https://snduk.com/eg/funds/x'])(
    'rejects the snduk.com page %j',
    (snduk) => {
      const result = SettingsSecuritySchema.safeParse({ ...EUR_SETTINGS.securities[0], snduk })

      expect(result.success).toBe(false)
      expect(result.error?.issues[0].message)
        .toBe('Must be the fund\'s slug in its snduk.com address, such as beltone-meya-100')
    },
  )

  it('accepts the currency a security is traded in', () => {
    const security = { ...EUR_SETTINGS.securities[0], currency: 'USD' }

    expect(SettingsSecuritySchema.parse(security).currency).toBe('USD')
    expect(SettingsSecuritySchema.safeParse({ ...security, currency: 'usd' }).success).toBe(false)
  })

  it('accepts an FX fee percentage for one security', () => {
    const security = { ...EUR_SETTINGS.securities[0], fxFeePercentage: 0.002 }

    expect(SettingsSecuritySchema.parse(security).fxFeePercentage).toBe(0.002)
  })

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

  it('accepts an optional fee warning percentage in [0, 1]', () => {
    expect(SettingsSchema.parse({ ...EUR_SETTINGS, feeWarningPercentage: 0.005 }))
      .toMatchObject({ feeWarningPercentage: 0.005 })
    expect(SettingsSchema.safeParse({ ...EUR_SETTINGS, feeWarningPercentage: 2 }).success)
      .toBe(false)
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
  const PRICES = { QDVE: { price: 28.45, currency: 'EUR' }, SPYD: { price: 62.1, currency: 'EUR' } }

  it('splits the entries into prices by tick and rates by currency pair', () => {
    expect(OverridesSchema.parse({ ...PRICES, 'USD/EUR': { rate: 0.92 } }))
      .toEqual({ prices: PRICES, rates: { 'USD/EUR': { rate: 0.92 } } })
  })

  it('accepts a tick → price map', () => {
    expect(OverridesSchema.parse(PRICES)).toEqual(EUR_OVERRIDES)
  })

  it('accepts an empty map', () => {
    expect(OverridesSchema.parse({})).toEqual({ prices: {}, rates: {} })
  })

  it('accepts an optional asOf date recording when a price or rate was looked up', () => {
    const overrides = {
      'QDVE': { ...PRICES.QDVE, asOf: '2026-10-01' },
      'USD/EUR': { rate: 0.92, asOf: '2026-10-02' },
    }

    expect(OverridesSchema.parse(overrides)).toEqual({
      prices: { QDVE: overrides.QDVE },
      rates: { 'USD/EUR': overrides['USD/EUR'] },
    })
  })

  it.each(['01.10.2026', '2026-13-01', 'yesterday'])('rejects the asOf %j', (asOf) => {
    const result = OverridesSchema.safeParse({ QDVE: { ...PRICES.QDVE, asOf } })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['QDVE', 'asOf'])
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

  it.each(['', ' ', 'usd', '€', 'EURO'])('rejects the currency %j', (currency) => {
    const result = OverridesSchema.safeParse({ QDVE: { price: 1, currency } })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['QDVE', 'currency'])
  })

  it.each([0, -0.9, '0.9'])('rejects the rate %j, reporting the pair in the path', (rate) => {
    const result = OverridesSchema.safeParse({ 'USD/EUR': { rate } })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['USD/EUR', 'rate'])
  })

  it('rejects a price given for a currency pair, and unknown keys in a rate', () => {
    const result = OverridesSchema.safeParse({ 'USD/EUR': { price: 0.92, currency: 'EUR' } })

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.path))
      .toEqual(expect.arrayContaining([['USD/EUR', 'rate'], ['USD/EUR']]))
  })

  it.each(['usd/eur', 'USD/EURO', 'USD/', '/EUR', 'USD/EUR/GBP', 'EUR/EUR'])(
    'rejects the currency pair %j',
    (pair) => {
      const result = OverridesSchema.safeParse({ [pair]: { rate: 1 } })

      expect(result.success).toBe(false)
      expect(result.error?.issues[0].path).toEqual([pair])
      expect(result.error?.issues[0].message).toBe(
        'A rate is keyed <FROM>/<TO> with two different 3-letter currency codes, such as USD/EUR',
      )
    },
  )

  it('names the entry in the file error', () => {
    expect(() => parseDataFile(OverridesSchema, { 'USD/EUR': { rate: -1 } }, FILE)).toThrow(
      `Invalid data file '${FILE}':\n✖ Too small: expected number to be >0\n  → at ["USD/EUR"].rate`,
    )
  })
})

describe('BrokerSchema', () => {
  it('accepts an empty object: every shared setting is optional', () => {
    expect(BrokerSchema.parse({})).toEqual({})
  })

  it('accepts the fee parts and the fee warning percentage', () => {
    const broker = {
      brokerageFeeFlat: 1,
      tradingFeePercentage: 0.001,
      minimumTradingFeeFlat: 2,
      feeWarningPercentage: 0.02,
    }

    expect(BrokerSchema.parse(broker)).toEqual(broker)
  })

  it.each([
    ['brokerageFeeFlat', -1],
    ['tradingFeePercentage', 1.5],
    ['feeWarningPercentage', -0.1],
  ])('rejects %s = %j', (field, value) => {
    const result = BrokerSchema.safeParse({ [field]: value })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual([field])
  })

  it.each(['cash', 'securities', 'brokerageFee'])(
    'rejects %s, which belongs to a portfolio or is misspelled',
    (key) => {
      expect(BrokerSchema.safeParse({ [key]: 1 }).success).toBe(false)
    },
  )
})

describe('tracked example data files', () => {
  const settings = new SettingsDataDriver(EXAMPLES_DIR)
  const overrides = new OverridesDataDriver(EXAMPLES_DIR)

  it('are two brokers outside the data folder, read through the data drivers', () => {
    expect(listPortfolioIds(EXAMPLES_DIR)).toEqual(['ibkr/eur', 'ibkr/mixed', 'thndr/egp'])
  })

  it('ibkr/eur is the example portfolio, with its fees from the broker file', async () => {
    await expect(settings.getPortfolioSettings('ibkr/eur'))
      .resolves.toEqual({ ...EUR_SETTINGS, fxFeePercentage: 0.0003 })
    await expect(overrides.getPortfolioOverrides('ibkr/eur')).resolves.toEqual(EUR_OVERRIDES)
  })

  it('ibkr/mixed pays in EUR for a security traded in USD, with an overridden rate', async () => {
    const mixed = await settings.getPortfolioSettings('ibkr/mixed')
    const { prices, rates } = await overrides.getPortfolioOverrides('ibkr/mixed')

    expect(mixed.currency).toBe('EUR')
    expect(mixed.fxFeePercentage).toBe(0.0003)
    expect(mixed.securities.map((sec) => sec.currency)).toEqual([undefined, 'USD'])
    expect(prices.CSPX.currency).toBe('USD')
    expect(rates['USD/EUR'].rate).toBe(0.89)
  })

  it('thndr/egp takes its broker\'s fees, with cash, a per-security fee and dated overrides', async () => {
    const egp = await settings.getPortfolioSettings('thndr/egp')

    expect(egp).toMatchObject({
      brokerageFeeFlat: 2, tradingFeePercentage: 0.002, minimumTradingFeeFlat: 10, cash: 150,
    })
    expect(egp.securities.map((sec) => sec.minimumTradingFeeFlat)).toEqual([undefined, 5])
    // Every security is overridden, so the example runs offline
    const { prices } = await overrides.getPortfolioOverrides('thndr/egp')
    expect(Object.keys(prices)).toEqual(egp.securities.map((sec) => sec.tick))
    expect(prices.BMM.asOf).toBe('2026-10-06')
  })
})
