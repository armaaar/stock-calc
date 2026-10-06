# ADR-0030: Scraper pages open in windows of their own, and justetf.com waits for a profile's quote

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0006](0006-race-multiple-price-sources.md) (how a driver opens its pages), [ADR-0025](0025-price-quotes-with-source-and-priority.md) (justetf.com's limits)

## Context

A live run often failed on its first attempt and passed moments later: `No price source could price 'EFIC'`, caused by tradingview.com's `Waiting for selector [data-symbol="EGX:EFIC"] .js-symbol-last failed`. Priced alone, EFIC always worked. justetf.com also failed now and then when several ETFs were priced together.

Live runs on 2026-10-06 (one headless browser, five TradingView symbols at once: `EGX:ETEL`, `EGX:EFIC`, `EGX:ADIB`, `LSE:ICOM`, `XETR:VUAA`) priced only one or two of the five per run. The others timed out after 30 s, although every page held the quote, with its text and a size, within 4 s.

- **Every page but the newest was a hidden background tab.** Each `browser.newPage()` opens a tab in the same window, and only the active tab is visible: the others report `document.visibilityState === 'hidden'`.
- **A hidden page never runs `requestAnimationFrame`, and `waitForSelector(…, { visible: true })` polls with it.** puppeteer switches to rAF polling whenever `visible` or `hidden` is set (`QueryHandler.js`). In a hidden page the first check runs and no other does. A quote that wasn't on the page at that first check is never seen, and the wait times out. Whether it was there depends on how fast the page loaded, so the same run could pass a moment later, and a symbol priced alone (the only, visible tab) always passed.
- **justetf.com's quote isn't in the page's HTML.** `<realtime-quotes id="realtime-quotes">` holds skeleton placeholders. The widget fetches the quote after the `load` event, usually within a second, but slower when many pages load at once. The driver gave it 2 s from `load`, so the quote could miss that limit under load. The 2 s limit was there to give up fast on an unknown ISIN. But an unknown ISIN redirects to a search page that has no `#realtime-quotes` at all, which is known as soon as the page loads.

## Decision

- **`BrowserController.newPage()` opens every scraper page in a window of its own** (`browser.newPage({ type: 'window' })`). Each page is the active, visible tab of its window, however many are open, so rAF runs and `{ visible: true }` keeps polling. Both browser drivers open their pages through it. Focus emulation (`page.emulateFocusedPage(true)`) also makes a tab visible, but it needs a second call on every page, and the page would be hidden until that call returned.
- **justetf.com checks that it loaded an ETF profile before waiting for the quote.** No `#realtime-quotes` after `goto` (an unknown ISIN's search page, or any other page it was sent to) fails at once with `No ETF profile at <url>`. A profile gets 10 s for its quote (`JUST_ETF_QUOTE_TIMEOUT`), as long as the page has to load (`JUST_ETF_NAVIGATION_TIMEOUT`).
- **No retries and no concurrency limit.** Each failure had a cause that a retry would only have hidden. Every source is still asked at once, and the answers are still taken in list order (ADR-0025).

## Consequences

- With pages in their own windows, every run of the five symbols priced all five (20 of 20 over four cold runs, each in 3 to 6 s), against one or two of five per run before.
- An unknown ISIN still fails fast, with the URL it landed on in the error, and a slow justetf.com quote no longer fails a security that tradingview.com may not list.
- The URL in the error shows where justetf.com sent a page. One live run on 2026-10-06 landed a known ISIN on `justetf.com/en/cookies-error.html`, shortly before justetf.com answered `429 Too Many Requests` to the test runs. It didn't happen again in a later run of four profiles loaded at once, each of which set its session cookies. It's left as observed: if it comes back without heavy use, consider letting the first justetf.com page in a browser load alone, so the others share its session.
- A listed ETF whose quote never comes now holds up the next source for up to 10 s after the page loads, instead of 2 s.
- Each page is a window, which costs a little more memory than a tab in headless Chromium. A run opens one page per security per browser driver, as before.
- Driver tests check that pages are opened with `{ type: 'window' }`, and the fake page in `src/__fixtures__/puppeteer.ts` answers `page.$(selector)`.
