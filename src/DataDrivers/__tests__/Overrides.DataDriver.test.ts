import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { EUR_OVERRIDES, EUR_OVERRIDES_JSONC } from '@/__fixtures__/dataFiles'
import { OverridesDataDriver } from '.././Overrides.DataDriver'

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn<(p: string) => boolean>(),
  readFileSync: vi.fn<(p: string) => Buffer>(),
}))

vi.mock('fs', () => ({ default: fsMock }))

const toPosix = (p: string) => p.replace(/\\/g, '/')

function givenFile(content: string | undefined) {
  fsMock.existsSync.mockReturnValue(content !== undefined)
  fsMock.readFileSync.mockReturnValue(Buffer.from(content ?? ''))
}

describe('OverridesDataDriver', () => {
  const driver = new OverridesDataDriver()

  beforeEach(() => {
    fsMock.existsSync.mockReset()
    fsMock.readFileSync.mockReset()
  })

  it('reads src/data/_overrides.<TYPE>.jsonc', async () => {
    givenFile(EUR_OVERRIDES_JSONC)

    await driver.getPortfolioOverrides('EGP')

    const checkedPath = toPosix(fsMock.existsSync.mock.calls[0][0])
    expect(checkedPath).toMatch(/\/src\/data\/_overrides\.EGP\.jsonc$/)
    expect(fsMock.readFileSync).toHaveBeenCalledWith(fsMock.existsSync.mock.calls[0][0])
  })

  it('returns the parsed overrides, accepting JSONC comments', async () => {
    givenFile(EUR_OVERRIDES_JSONC)

    await expect(driver.getPortfolioOverrides('EUR')).resolves.toEqual(EUR_OVERRIDES)
  })

  it('returns {} when the overrides file is missing', async () => {
    givenFile(undefined)

    await expect(driver.getPortfolioOverrides('EUR')).resolves.toEqual({})
    expect(fsMock.readFileSync).not.toHaveBeenCalled()
  })

  it('returns {} for a file with an empty object', async () => {
    givenFile('{ /* nothing overridden */ }')

    await expect(driver.getPortfolioOverrides('EUR')).resolves.toEqual({})
  })

  it('throws an "Invalid data file" error with the field path for an invalid shape', async () => {
    givenFile('{ "QDVE": { "price": "28.45", "currency": "EUR" } }')

    const error = await driver.getPortfolioOverrides('EUR').catch((e: Error) => e)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/^Invalid data file '.*_overrides\.EUR\.jsonc':/)
    expect((error as Error).message).toContain('QDVE.price')
  })

  // Current behaviour: unlike a missing file, an existing but empty file is an error.
  it('throws "Invalid data file" for an empty file', async () => {
    givenFile('')

    await expect(driver.getPortfolioOverrides('EUR')).rejects.toThrow(/Invalid data file/)
  })
})
