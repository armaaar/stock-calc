import fs from 'fs'
import path from 'path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConsoleSpies, printedLines, spyOnConsole } from '#src/__fixtures__/console'
import { createDataDir } from '#src/__fixtures__/dataFiles'

const EXAMPLES = path.resolve(import.meta.dirname, '../../data')

/** A data folder holding the tracked examples as the TMP portfolio: every price is overridden. */
function createTmpDataDir(): string {
  const example = (name: string) => fs.readFileSync(path.join(EXAMPLES, name), 'utf8')
  return createDataDir({
    '_settings.TMP.jsonc': example('_settings.EUR.jsonc.example'),
    '_overrides.TMP.jsonc': example('_overrides.EUR.jsonc.example'),
  })
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
    await runApp('invest', '1000', '--pt', 'TMP')

    const [rows] = spies.table.mock.calls[0] as [{ Tick: string, Shares: number }[]]
    expect(rows.map(({ Tick, Shares }) => [Tick, Shares])).toEqual([['QDVE', 141], ['SPYD', 97]])
    expect(printedLines(spies.log)).toEqual([
      'Trading Fee: 2 EUR',
      'Trading Price: 980.15 EUR',
      'Portfolio Price: 10035.15 EUR',
      '',
    ])
    expect(spies.error).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
  })

  it('presents a missing portfolio as an error and sets exit code 1', async () => {
    await runApp('show', '--pt', 'NOPE')

    expect(printedLines(spies.error)).toHaveLength(1)
    expect(printedLines(spies.error)[0]).toMatch(/^Error: .*NOPE/)
    expect(spies.table).not.toHaveBeenCalled()
    expect(process.exitCode).toBe(1)
  })
})
