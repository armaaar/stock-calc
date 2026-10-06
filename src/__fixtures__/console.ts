import { stripVTControlCharacters } from 'node:util'
import { type MockInstance, vi } from 'vitest'

export interface ConsoleSpies {
  log: MockInstance<typeof console.log>
  table: MockInstance<typeof console.table>
  error: MockInstance<typeof console.error>
}

/** Silences console.log / console.table / console.error and returns the spies. */
export function spyOnConsole(): ConsoleSpies {
  return {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    table: vi.spyOn(console, 'table').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  }
}

/** One string per call of the spied console method, with ANSI colour codes stripped. */
export function printedLines(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls.map(
    (args) => stripVTControlCharacters(args.map((arg) => String(arg)).join(' ')),
  )
}
