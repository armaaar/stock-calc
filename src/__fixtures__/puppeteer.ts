import { vi } from 'vitest'
import type { Browser } from 'puppeteer'

/**
 * What a fake `page.waitForSelector(selector)` does:
 * - `{ text }`: resolves to an element whose `evaluate(fn)` calls `fn({ textContent: text })`
 * - `null`: resolves to `null` (what puppeteer returns for e.g. `{ hidden: true }`)
 * - an `Error`: rejects with it (e.g. a selector timeout)
 * Selectors that aren't listed reject with a timeout error.
 *
 * A fake `page.$(selector)` checks the page as it is: it resolves to the element of a `{ text }`
 * selector, and to `null` for any other.
 */
export type FakeSelectorResult = { text: string | null } | null | Error

/**
 * A fake page. `url()` is the last URL `goto` loaded, like a page that wasn't redirected; mock it
 * to fake a redirect.
 */
export function createFakePage(selectors: Record<string, FakeSelectorResult> = {}) {
  let current = 'about:blank'
  const element = (text: string | null) => ({
    evaluate: vi.fn(async (fn: (el: { textContent: string | null }) => unknown) => (
      fn({ textContent: text })
    )),
  })
  return {
    goto: vi.fn<(url: string) => Promise<null>>(async (url) => {
      current = url
      return null
    }),
    url: vi.fn<() => string>(() => current),
    setDefaultTimeout: vi.fn<(timeout: number) => void>(),
    setDefaultNavigationTimeout: vi.fn<(timeout: number) => void>(),
    close: vi.fn(async () => undefined),
    waitForSelector: vi.fn(async (selector: string) => {
      if (!(selector in selectors)) {
        throw Error(`Waiting for selector \`${selector}\` failed`)
      }
      const result = selectors[selector]
      if (result instanceof Error) throw result
      if (result === null) return null
      return element(result.text)
    }),
    $: vi.fn(async (selector: string) => {
      const result = selectors[selector] as FakeSelectorResult | undefined
      return result && !(result instanceof Error) ? element(result.text) : null
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

/** A `BrowserLauncher` that resolves to the given fakes, in order, then keeps the last one. */
export function fakeLauncher(...browsers: FakeBrowser[]) {
  const queue = browsers.length > 0 ? browsers : [createFakeBrowser()]
  let next = 0
  return vi.fn(async () => {
    const browser = queue[Math.min(next, queue.length - 1)]
    next++
    return browser as unknown as Browser
  })
}
