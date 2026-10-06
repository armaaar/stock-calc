# ADR-0005: Scrape live prices with a headless browser

- **Status:** Accepted
- **Date:** 2023-09-09
- **Introduced in:** `7310fac` "feat: get prices live"

## Context

Allocations are only meaningful with current prices. In the first version (`3fa4282`), each security's price was hard-coded in the source next to its tick and percentage. The securities held are mostly European-listed ETFs (identified by ISIN) and Egyptian Exchange (EGX) stocks. Free, keyless market-data APIs that cover both are scarce. The public quote pages render prices client-side, so a plain HTTP fetch of the HTML doesn't contain them.

## Decision

We will fetch prices by loading public quote pages in headless Chromium through `puppeteer` and reading the price and currency from the DOM with CSS selectors. Browser lifecycle is shared through the `BrowserController` abstract base class (`launchBrowser` / `getBrowser` / `closeBrowser`).

## Consequences

- No API keys, accounts, or paid subscriptions are needed.
- Selectors are tied to third-party markup and break silently when those sites change. Price overrides ([ADR-0008](0008-manual-price-overrides.md)) are the escape hatch.
- Each run downloads and launches Chromium (a large dependency) and is slow compared with an API call.
- Scraping may conflict with the target sites' terms of use. The tool is intended for personal, low-volume use.
