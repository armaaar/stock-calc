# ADR-0029: Mutual funds are priced at their NAV from snduk.com

- **Status:** Accepted
- **Date:** 2026-10-06
- **Amends:** [ADR-0025](0025-price-quotes-with-source-and-priority.md) (a third price source, first in the list, and a source may date its own quote)

## Context

The owner holds Egyptian mutual funds, such as Beltone Meya Meya (BMM) on Thndr, and uses them a lot. A mutual fund isn't traded on an exchange: it's bought and redeemed at its net asset value (NAV), published once a day. justetf.com (ETFs) and tradingview.com (exchange listings) don't list them, so each fund needed a hand-entered price override, updated daily.

The sources were compared in October 2026, looking for one that covers the funds of every manager, not just one:

| Source | NAV published? | Coverage | Machine-readable | Verdict |
| --- | --- | --- | --- | --- |
| Beltone (fund manager) | No: only prospectus PDFs | Its own funds | — | No |
| Thndr (broker) | Only in the signed-in app | Funds it sells | — | No |
| EGX (index-tracking funds page) | No: names and approval dates only | Index funds | — | No |
| FRA (regulator) | No | — | — | No |
| Mubasher | Behind a sign-in | All | — | No |
| FoudaLens | Yes, ids `MUB-<n>` (from Mubasher) | 148 funds | Precise NAV only in a meta description; JSON-LD rounds it; blocks headless browsers (HTTP 403) | Fallback candidate |
| **snduk.com** | **Yes, with the NAV date** | **172 Egyptian funds** | **The fund's record (code, currency, NAV, NAV date) is in the server-rendered page; no browser needed** | **Chosen** |

Both FoudaLens's and Snduk's `robots.txt` allow fund pages and disallow `/api/`. Snduk's fund list loads through its API, so it can't be read; each fund's page can.

## Decision

- **A security can name its snduk.com fund page**: `"snduk": "beltone-meya-100"`, the `<slug>` in `snduk.com/eg/funds/<slug>`. The schema allows only slug characters, so the value can't change the URL's path.
- **`SndukDataDriver`** fetches that page with a plain HTTP request (the injected `fetch`; 15 s timeout; a `stock-calc (+repo URL)` user agent), and reads the fund records Next.js streams in the page (`self.__next_f.push` chunks): the JSON object around each `"currentPrice"` key, validated with zod (`SndukFund.parser.ts`). It never reads the visible markup, whose classes are utility classes that change.
- **The page must be for that security**: the record whose `code` is the security's `tick` (ignoring case) is used, so a wrong slug fails instead of pricing another fund. Its `currency` is the quote's, so a USD fund is converted like any other foreign quote ([ADR-0028](0028-multi-currency-portfolios.md)).
- **A source may date its quote.** `getPrice` returns an optional `quotedAt`; Snduk gives the NAV's date (`lastPriceUpdate`). The repository stamps the quote with it instead of the time it was read, so the Quote column shows how old the NAV is (`snduk.com 2026-10-06`).
- **A fund is priced only from its fund page.** Each price source says which securities it can price (`canPrice`): Snduk those with a `snduk` page, justetf.com those with an ISIN, tradingview.com any listing, and neither of the last two a fund. The repository asks a security only the sources that can, and launches only the sources some price to scrape needs. So a fund whose page fails (a wrong slug, a changed page, a timeout) fails the run with Snduk's error instead of being priced from an exchange listing that happens to share its code, and a portfolio of funds starts no browser. It has no browser itself: `launchBrowser` / `closeBrowser` do nothing.

## Consequences

- Any fund Snduk lists is priced daily without hand-entered overrides. An override still wins, as for any security.
- Snduk is a third-party aggregator, not the fund manager. If its page changes shape, the parser finds no record and the run fails with `Fund '<slug>' is not registered in snduk.com` and the cause; an override works until the parser is fixed. FoudaLens is the fallback candidate.
- A NAV is the previous business day's at the earliest. The plan shows its date; a plan made on a holiday uses the last published NAV.
- Every run that needs a fund's price makes one HTTP request per fund page, well inside what robots.txt allows.
- A stock's error no longer lists sources that never applied to it (Snduk for a security without a fund page, justetf.com without an ISIN).
