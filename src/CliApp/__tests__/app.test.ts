import fs from 'fs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'
import { createDataDir, exampleFiles } from '#src/__fixtures__/dataFiles'

/** A data folder holding the tracked example broker: every price is overridden. */
function createTmpDataDir(): string {
  return createDataDir(exampleFiles())
}

const originalArgv = process.argv

/** Runs src/CliApp/app.ts as if invoked with `tsx src/CliApp/app.ts ...args`. */
async function runApp(...args: string[]) {
  process.argv = ['node', 'src/CliApp/app.ts', ...args]
  vi.resetModules()
  await import('#src/CliApp/app')
}

describe('CLI app entry point', () => {
  let dataDir: string
  let spies: ConsoleSpies

  beforeAll(() => {
    dataDir = createTmpDataDir()
  })

  afterAll(() => {
    fs.rmSync(dataDir, { recursive: true })
  })

  beforeEach(() => {
    spies = spyOnConsole()
    vi.stubEnv('STOCK_CALC_DATA_DIR', dataDir)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.argv = originalArgv
    process.exitCode = undefined
  })

  it('runs a command end to end against the data folder', async () => {
    // The app awaits cli.parseAsync(), so the action has finished once the import resolves.
    await runApp('invest', '1000', '--pt', 'demo/eur')

    const [rows] = spies.table.mock.calls[0] as [{ Tick: string, Shares: number }[]]
    expect(rows.map(({ Tick, Shares }) => [Tick, Shares])).toEqual([['QDVE', 141], ['SPYD', 97]])
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 2 EUR',
      'Trading Price: 980.15 EUR',
      'Portfolio Price: 10035.15 EUR',
      'Cash After Trades: 17.85 EUR',
      '',
    ])
    expect(spies.error).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
  })

  it('asks to choose a portfolio when there are several and none is given', async () => {
    await runApp('show')

    expect(printedLines(spies.error))
      .toEqual(['Error: Choose a portfolio. Portfolios: demo/egp, demo/eur'])
    expect(process.exitCode).toBe(1)
  })

  it('presents a missing portfolio as an error and sets exit code 1', async () => {
    await runApp('show', '--pt', 'demo/nope')

    expect(printedLines(spies.error)).toEqual([
      `Error: Portfolio 'demo/nope' not found in '${dataDir}'. `
      + 'Portfolios: demo/egp, demo/eur',
    ])
    expect(spies.table).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })
})
