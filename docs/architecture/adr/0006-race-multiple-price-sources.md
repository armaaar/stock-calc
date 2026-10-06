# ADR-0006: Race multiple price sources, one browser per source per run

- **Status:** Accepted
- **Date:** 2023-10-07
- **Introduced in:** `73b70ce` "feat: add trading view data driver", `9f9f495` "fix: fix too many browsers memory leak". Refined in `d0190df` "fix: close browser without closing pages" (2023-10-15) and `8eaae83` (TradingView timeout raised to 30 s).

## Context

justetf.com only covers ETFs and needs an ISIN. Stocks such as EGX listings need a different source. A security may be resolvable by either source, by only one, or by neither. Launching one browser per price request exhausted memory with larger portfolios.

## Decision

- Every price source implements `IPriceDataDriver.getPrice(setting)`.
- `PortfolioRepository.getPrice` calls **all** sources concurrently and takes the first success with `Promise.any`. Sources aren't ordered by priority; the fastest successful one wins.
- Each driver owns **one** browser for the whole run. The repository launches all browsers before fetching and closes them in `finally`. Individual pages are not closed by drivers, because the slower, losing driver may still be using its page when the race settles. Closing the browser cleans up all pages.
- Per-source timeouts reflect how reliable each source is: 2 s for JustEtf (fails fast when an ISIN is unknown) and 30 s for TradingView.

## Consequences

- A security only needs enough identifiers for **one** source to succeed.
- If every source fails, the `AggregateError` contains one message per source, which helps diagnose bad ticks or ISINs.
- When two sources both succeed, the winner is nondeterministic. They may disagree slightly on price, or on currency formatting, which matters for the single-currency invariant.
- Browsers were launched even when every price was overridden. Since 2026-10-06 they are launched only when some security needs scraping.
- Adding a source means adding it to the driver list **and** to the launch/close calls in the repository.
