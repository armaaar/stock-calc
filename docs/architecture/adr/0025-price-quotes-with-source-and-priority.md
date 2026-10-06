# ADR-0025: Price quotes record their source and time, and sources answer in priority order

- **Status:** Accepted
- **Amended by:** [ADR-0028](0028-multi-currency-portfolios.md) (exchange rates are sourced the same way; a source quoting another listing than the security's `currency` is skipped), [ADR-0029](0029-mutual-fund-navs-from-snduk.md) (snduk.com prices mutual funds, first in the list; a source may date its quote), [ADR-0030](0030-visible-scraper-pages.md) (justetf.com fails at once on a page that isn't an ETF profile, then gives the quote 10 s)
- **Date:** 2026-10-06
- **Amends:** [ADR-0006](0006-race-multiple-price-sources.md) (the race becomes a priority order), [ADR-0008](0008-manual-price-overrides.md) (overrides can be dated)

## Context

- `Security` mixed the instrument's identity (tick, exchange, ISIN) with its price quote (price, currency). Quotes recorded neither where nor when they were obtained, so a plan couldn't say how fresh or how trustworthy its prices were. Hand-entered overrides, which can be days old, looked exactly like live prices.
- ADR-0006 raced the live sources with `Promise.any`. When both justetf.com and tradingview.com could price a security, the faster one won. They can differ slightly, so the same portfolio could be planned with different prices from one run to the next.

## Decision

- **`PriceQuote` is a value object** (`src/Entities/PriceQuote.ValueObject.ts`). It holds the price (a `Decimal` ≥ 0), the currency, an optional `source` and an optional `quotedAt`: an ISO 8601 string, either a UTC timestamp for a live quote or a bare date for an override. A string keeps the value object immutable, and a date stays a date instead of becoming a made-up midnight. It validates itself, so a bad price is reported as a `PriceQuote` error before the security's identity is checked. `Security` keeps its identity fields and holds a `quote`. `price` and `currency` are read-only views of it.
- **Every live source has a `name`** (`justetf.com`, `tradingview.com`) on `IPriceDataDriver`. The repository stamps each live quote with that name and the time from its injected clock (`now`, default `new Date()`).
- **Overrides are sourced `override`.** An entry may carry `asOf: "YYYY-MM-DD"`, which becomes its `quotedAt` as given, a date with no time of day. Without it the time is unknown.
- **Sources answer in priority order.** All sources are still asked at once, but the repository takes the answers in the order of the `prices` list: the first source that can price the security wins, however fast the others are. If every source fails, it rejects with an `AggregateError` named `No price source could price '<tick>'` that holds each source's error, in list order.
- **Every interface shows the quote.** The view model shows `priceSource` and `pricedAt` (ISO 8601) on every security. The CLI renders a `Quote` column, for example `justetf.com 2026-10-06 09:30` (UTC, to the minute), `override 2026-10-01`, or plain `override`. The MCP tool returns both fields.

## Consequences

- The same inputs always give the same prices, and every price says where it came from and how old it is.
- Overrides stand out in every plan, so a stale hand-entered price is easy to spot.
- A slow preferred source now delays a price that a faster, lower-priority source already has. The wait is bounded by each driver's own timeouts. justetf.com, listed first, gives up after 10 s loading the page and 2 s waiting for the quote. Both limits are set before navigating. It fails at once when there's no ISIN. (Since [ADR-0030](0030-visible-scraper-pages.md), it also fails at once when the loaded page isn't an ETF profile, and gives a profile's quote 10 s.)
