import { vi } from 'vitest'

/**
 * What a fake `page.waitForSelector(selector)` does:
 * - `{ text }`: resolves to an element whose `evaluate(fn)` calls `fn({ textContent: text })`
 * - `null`: resolves to `null` (what puppeteer returns for e.g. `{ hidden: true }`)
 * - an `Error`: rejects with it (e.g. a selector timeout)
 * Selectors that aren't listed reject with a timeout error.
 */
export type FakeSelectorResult = { text: string | null } | null | Error

export function createFakePage(selectors: Record<string, FakeSelectorResult> = {}) {
  return {
    goto: vi.fn<(url: string) => Promise<null>>(async () => null),
    setDefaultTimeout: vi.fn<(timeout: number) => void>(),
    close: vi.fn(async () => undefined),
    waitForSelector: vi.fn(async (selector: string) => {
      if (!(selector in selectors)) {
        throw Error(`Waiting for selector \`${selector}\` failed`)
      }
      const result = selectors[selector]
      if (result instanceof Error) throw result
      if (result === null) return null
      return {
        evaluate: vi.fn(async (fn: (el: { textContent: string | null }) => unknown) => (
          fn({ textContent: result.text })
        )),
      }
    }),
  }
}

export type FakePage = ReturnType<typeof createFakePage>

export function createFakeBrowser(page: FakePage = createFakePage()) {
  return {
    page,
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  }
}

export type FakeBrowser = ReturnType<typeof createFakeBrowser>
