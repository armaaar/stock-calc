import fs from 'fs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Browser } from 'puppeteer'
import { createDataDir, exampleFiles } from '#src/__fixtures__/dataFiles'
import { createFakeBrowser, FakeBrowser } from '#src/__fixtures__/puppeteer'
import { composePortfolioUseCases } from '../compositionRoot'

const { launch } = vi.hoisted(() => ({ launch: vi.fn<() => Promise<Browser>>() }))

// The outermost process boundary: no test may start a real Chromium
vi.mock('puppeteer', () => ({ launch }))

/** QDVE is overridden, XYZ has to be scraped. */
const LIVE_SETTINGS = JSON.stringify({
  securities: [
    { tick: 'QDVE', exchange: 'IBIS2', isin: 'IE00B3WJKG14', shares: 100, targetPercentage: 0.4 },
    { tick: 'XYZ', exchange: 'IBIS2', isin: 'IE0000000000', shares: 10, targetPercentage: 0.6 },
  ],
})

type Holdings = { securities: readonly { tick: string, shares: number }[] }

function shares({ securities }: Holdings) {
  return securities.map(({ tick, shares: count }) => [tick, count])
}

describe('composePortfolioUseCases', () => {
  let dataDir: string

  beforeAll(() => {
    // The tracked example broker, where every price is overridden, and a live portfolio
    const examples = exampleFiles()
    dataDir = createDataDir({
      ...examples,
      'example/live.jsonc': LIVE_SETTINGS,
      'example/live.overrides.jsonc': examples['example/eur.overrides.jsonc'],
    })
  })

  afterAll(() => {
    fs.rmSync(dataDir, { recursive: true })
  })

  beforeEach(() => {
    launch.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('wires the real use cases, repository and file drivers on the given data folder', async () => {
    const portfolio = await composePortfolioUseCases(dataDir).invest.execute({
      portfolio: 'example/eur', investment: 1000,
    })

    expect(shares(portfolio)).toEqual([['QDVE', 141], ['SPYD', 97]])
    expect(portfolio.totalPrice.toNumber()).toBe(10035.15)
    // Every price is overridden, so no browser is started
    expect(launch).not.toHaveBeenCalled()
  })

  it('exposes every operation', () => {
    expect(Object.keys(composePortfolioUseCases(dataDir)))
      .toEqual(['show', 'minimal', 'target', 'rebalance', 'invest'])
  })

  it('reads the data folder from STOCK_CALC_DATA_DIR by default', async () => {
    vi.stubEnv('STOCK_CALC_DATA_DIR', dataDir)

    const portfolio = await composePortfolioUseCases().show.execute({ portfolio: 'example/eur' })

    expect(shares(portfolio)).toEqual([['QDVE', 100], ['SPYD', 100]])
  })

  it('launches headless browsers for live prices and closes them afterwards', async () => {
    const browsers: FakeBrowser[] = [createFakeBrowser(), createFakeBrowser()]
    for (const browser of browsers) {
      launch.mockResolvedValueOnce(browser as unknown as Browser)
    }

    // The fake pages never show a price, so both scrapers fail
    const error = await composePortfolioUseCases(dataDir).show
      .execute({ portfolio: 'example/live' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors.map((e: Error) => e.message)).toEqual([
      'ISIN \'IE0000000000\' is not registered in justetf.com',
      'Tick \'XYZ\' at \'IBIS2\' is not registered in tradingview.com',
    ])
    expect(launch.mock.calls).toEqual([[{ headless: true }], [{ headless: true }]])
    for (const browser of browsers) {
      expect(browser.close).toHaveBeenCalledOnce()
    }
  })
})
