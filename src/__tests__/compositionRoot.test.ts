import fs from 'fs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Browser } from 'puppeteer'
import { createDataDir, exampleFiles } from '#src/__fixtures__/dataFiles'
import { createFakeBrowser, FakeBrowser } from '#src/__fixtures__/puppeteer'
import { BMM_FUND, sndukFundPage } from '#src/__fixtures__/snduk'
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
      'ibkr/live.jsonc': LIVE_SETTINGS,
      'ibkr/live.overrides.jsonc': examples['ibkr/eur.overrides.jsonc'],
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
      portfolio: 'ibkr/eur', investment: 1000,
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

    const portfolio = await composePortfolioUseCases().show.execute({ portfolio: 'ibkr/eur' })

    expect(shares(portfolio)).toEqual([['QDVE', 100], ['SPYD', 100]])
  })

  it('uses the only portfolio in the data folder when none is named', async () => {
    const examples = exampleFiles()
    const single = createDataDir({
      'ibkr/_broker.jsonc': examples['ibkr/_broker.jsonc'],
      'ibkr/eur.jsonc': examples['ibkr/eur.jsonc'],
      'ibkr/eur.overrides.jsonc': examples['ibkr/eur.overrides.jsonc'],
    })

    try {
      const portfolio = await composePortfolioUseCases(single).rebalance.execute({})

      expect(shares(portfolio)).toEqual([['QDVE', 127], ['SPYD', 87]])
    } finally {
      fs.rmSync(single, { recursive: true })
    }
  })

  it('prices a mutual fund from its snduk.com page with the global fetch', async () => {
    // The network is the process boundary: no test makes a real request
    const fetchPage = vi.fn(async () => new Response(sndukFundPage(BMM_FUND)))
    vi.stubGlobal('fetch', fetchPage)
    launch.mockImplementation(async () => createFakeBrowser() as unknown as Browser)
    const funds = createDataDir({
      'thndr/funds.jsonc': JSON.stringify({
        securities: [{
          tick: 'BMM', exchange: 'EGX', snduk: 'beltone-meya-100', shares: 10, targetPercentage: 1,
        }],
      }),
    })

    try {
      const [bmm] = (await composePortfolioUseCases(funds).show.execute({})).securities

      expect(bmm.price.toNumber()).toBe(2.4326)
      expect(bmm.quote).toMatchObject({ source: 'snduk.com', quotedAt: '2026-10-06' })
      expect(fetchPage).toHaveBeenCalledWith(
        'https://snduk.com/eg/funds/beltone-meya-100?lang=en',
        expect.objectContaining({ headers: expect.any(Object) }),
      )
    } finally {
      vi.unstubAllGlobals()
      fs.rmSync(funds, { recursive: true })
    }
  })

  it('launches headless browsers for live prices and closes them afterwards', async () => {
    const browsers: FakeBrowser[] = [createFakeBrowser(), createFakeBrowser()]
    for (const browser of browsers) {
      launch.mockResolvedValueOnce(browser as unknown as Browser)
    }

    // The fake pages never show a price, so both scrapers fail. XYZ names no fund page, so
    // snduk.com, asked first, gives up without a request
    const error = await composePortfolioUseCases(dataDir).show
      .execute({ portfolio: 'ibkr/live' })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(AggregateError)
    expect((error as AggregateError).errors.map((e: Error) => e.message)).toEqual([
      'No snduk.com fund page set',
      'ISIN \'IE0000000000\' is not registered in justetf.com',
      'Tick \'XYZ\' at \'IBIS2\' is not registered in tradingview.com',
    ])
    expect(launch.mock.calls).toEqual([[{ headless: true }], [{ headless: true }]])
    for (const browser of browsers) {
      expect(browser.close).toHaveBeenCalledOnce()
    }
  })
})
