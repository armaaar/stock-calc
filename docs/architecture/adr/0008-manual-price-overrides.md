# ADR-0008: Manual price overrides per portfolio

- **Status:** Accepted
- **Date:** 2024-07-21
- **Introduced in:** `975c124` "feat: create price overrides"

## Context

Some securities can't be priced by any scraper: unsupported exchanges, symbols the sites don't list, or markup changes ([ADR-0005](0005-scrape-prices-with-headless-browser.md)). Sometimes the user also wants to plan with a hypothetical or limit-order price instead of the last traded price. Before this decision, a single unresolvable security failed the whole run.

## Decision

An optional file `src/data/_overrides.<TYPE>.jsonc` maps **tick → `{ price, currency }`** (`Record<string, SecurityPriceDto>`, validated with typia). When a security's tick appears in it, the repository uses that price and skips all scrapers for that security. If the file doesn't exist, no overrides apply.

## Consequences

- Any portfolio can be fully priced offline by overriding every tick.
- Overrides are keyed by tick only. Two securities with the same tick on different exchanges can't be overridden separately.
- An override stays in effect until removed, so old overrides can quietly produce outdated allocations.
- The override's `currency` has to match the other securities' currency, or the portfolio's single-currency invariant fails.
