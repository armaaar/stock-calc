# Stocks Calculator

This is a small tool to help calculate your stock investments. Use it from the command line, or let an AI assistant use it through its [MCP server](#mcp-server).

## Setup

Requires Node 22 (see `.nvmrc`).

```sh
npm install
npx puppeteer browsers install chrome   # only if npm install didn't download Chrome
```

## Portfolio

Portfolios live in the data folder (`src/data`, or the folder `STOCK_CALC_DATA_DIR` names), in a folder per broker. A broker is just a folder name, so any broker works, and a broker can hold several portfolios:

```
src/data/
  ibkr/
    _broker.jsonc          optional: settings every IBKR portfolio shares, such as fees
    eur.jsonc              the portfolio ibkr/eur
    eur.overrides.jsonc    optional: price and exchange-rate overrides for ibkr/eur
    growth.jsonc           the portfolio ibkr/growth
  thndr/
    egp.jsonc              the portfolio thndr/egp
```

To create a portfolio, create `src/data/<broker>/<portfolio>.jsonc`, and select it with `--pt <broker>/<portfolio>` (for example `--pt ibkr/eur`). Broker and portfolio names may contain letters, digits, `_` and `-`, and start with a letter or digit. With only one portfolio in the data folder, `--pt` can be left out; with several, the error lists them. The files use the `.jsonc` extension, so comments are allowed. Everything in `src/data` is git-ignored.

### Examples

[`examples/`](examples/README.md) is a complete data folder to copy from: an `ibkr` broker with a EUR portfolio and a portfolio that pays in EUR for a security traded in USD, and a `thndr` broker with an EGP portfolio. Every price in it is overridden, so it runs offline:

```sh
STOCK_CALC_DATA_DIR=examples npm run cli -- rebalance --pt ibkr/mixed
```

```jsonc
// examples/ibkr/mixed.jsonc
{
  "currency": "EUR",                 // what orders are paid in
  "securities": [
    { "tick": "QDVE", "exchange": "IBIS2", "isin": "IE00B3WJKG14", "shares": 100, "targetPercentage": 0.4 },
    { "tick": "CSPX", "exchange": "LSE", "isin": "IE00B5BMR087", "currency": "USD", "shares": 5, "targetPercentage": 0.6 }
  ]
}
```

### Portfolio file

`<broker>/<portfolio>.jsonc` contains:

- `securities`: A list of securities in a portfolio.
- `currency`: (Optional) The currency you pay for orders in, as a 3-letter code such as `EUR`. Every price, fee, cash amount and total is in it, and a security quoted in another currency is converted at an [exchange rate](#currencies). Without it, every security must be quoted in one currency, which is then the portfolio's.
- `cash`: (Optional) Uninvested cash you hold with the portfolio, in its currency (default 0). `rebalance` and `invest` spend it too. Cash a broker account holds for several portfolios is split by hand: give each portfolio the part it may use.
- `brokerageFeeFlat`: (Optional) A flat amount of money the brokerage takes on each order. It's added to each order no matter what the value is.
- `tradingFeePercentage`: (Optional) The trading fee is taken as a percentage of the total order value, for buys and sells alike.
- `minimumTradingFeeFlat`: (Optional) The minimum amount of trading fee that is taken.
- `fxFeePercentage`: (Optional) The fee for exchanging currency, as a fraction of the value of an order in a security quoted in another currency than the portfolio's. For example `0.0003` for IBKR's automatic conversion (0.03%).
- `feeWarningPercentage`: (Optional) Plans warn about each order whose fee is more than this fraction of the order's value (default `0.01`, so 1%). Small orders with a flat fee are the usual culprits.

The `securities` list consists of security objects, which contains:

- `tick`: The tick of the security.
- `exchange`: The exchange symbol for the security, as [tradingview.com](https://www.tradingview.com) names it (its page is `tradingview.com/symbols/<EXCHANGE>-<TICK>/`, for example `LSE` for the London Stock Exchange).
- `shares`: The number of shares the portfolio have of this security.
- `targetPercentage`: The percentage this security contributes to in the portfolio. Must be 1 or less.
- `isin`: (Optional) An [International Securities Identification Number (ISIN)](https://en.wikipedia.org/wiki/International_Securities_Identification_Number) is a 12-digit alphanumeric code that uniquely identifies a specific security. Can be used to find the security.
- `currency`: (Optional) The currency the security is traded in, as a 3-letter code. Set it when a source could quote another listing of it: justetf.com, for example, may quote a USD-traded ETF from a EUR listing. A quote in another currency is then skipped, so the next source prices the listing you trade.
- `brokerageFeeFlat`, `tradingFeePercentage`, `minimumTradingFeeFlat`, `fxFeePercentage`: (Optional) This security's own fees, for a broker that charges this listing differently. Fees are amounts in the portfolio's currency, so convert a fee quoted in another currency by hand (for example 4 USD ≈ 3.56 EUR).

The price of each security is fetched automatically from public records using either the combination of the tick and exchange, or using the isin if available. justetf.com only lists ETFs and ETCs; a stock such as one on the EGX is priced by TradingView, so its `exchange` and `tick` must match TradingView's. When no source lists a security, give it a [price override](#price-overrides). That includes a mutual fund bought at its daily NAV rather than on an exchange, such as Beltone Meya Meya (BMM) on Thndr: override it with its latest NAV. When both sites can price a security, justetf.com's price is used, so the same portfolio always gets the same prices.

### Broker file

`<broker>/_broker.jsonc` (optional) holds what the broker's portfolios share: `brokerageFeeFlat`, `tradingFeePercentage`, `minimumTradingFeeFlat`, `fxFeePercentage` and `feeWarningPercentage`. Each fee part is taken from the most specific place that sets it: the security, then the portfolio, then the broker. A part set nowhere is 0.

### Currencies

A portfolio can hold securities quoted in other currencies than the one you pay in. Each one's price is converted at the exchange rate into the portfolio's `currency`, fetched live from tradingview.com (the `FX_IDC:<FROM><TO>` pair), and every order in it pays the `fxFeePercentage` fee on top of its trading fee. Plans show the converted price in `Price`, the price as listed and the rate in `Listed` (`702.5 USD @ 0.89`), and a line per rate with where and when it was quoted:

```
ibkr/mixed (EUR)
… table …
Rate: USD/EUR 0.89 (override 2026-10-06)
```

### Price overrides

To skip fetching for some securities (for example, when no source lists them), create `<broker>/<portfolio>.overrides.jsonc` next to the portfolio. Prices are keyed by tick, and exchange rates by `<FROM>/<TO>`:

```jsonc
{
  "QDVE": { "price": 28.45, "currency": "EUR" },
  "CSPX": { "price": 702.5, "currency": "USD", "asOf": "2026-10-06" },
  "USD/EUR": { "rate": 0.89, "asOf": "2026-10-06" } // one USD is worth 0.89 EUR
}
```

Currencies are 3-letter codes, and a rate must convert into the portfolio's `currency`. Add `"asOf": "YYYY-MM-DD"` to record when you looked a price or rate up. Plans show each price's source and time in the `Quote` column (`override`, `justetf.com`, `tradingview.com`), and each rate's on its `Rate:` line, so a stale override is easy to spot.

## Documentation

Architecture, decision records, and domain docs are in [`docs/`](docs/README.md).

## Available operations

The tool can be used by running:

```sh
npm run cli -- <command> [options]
```

This is a list of global options available in all operations

- `--pt, --portfolio <broker/portfolio>`: the portfolio to use, for example `ibkr/eur` (default: the only portfolio in the data folder; with several, the error lists them)
- `-h, --help`: display help for command

### Show Portfolio

Show information about the current portfolio.

```sh
npm run cli -- show [options]
npm run cli:show -- [options]
```

### Create minimal portfolio

Calculates the minimum number of shares you need to buy to satisfy your portfolio.

```sh
npm run cli -- minimal [options]
npm run cli:minimal -- [options]
```

- Options:
- `-p, --precision <precision>`: how much can your securities percentage deviate from target (default: "0.01")
- `-s, --shares-step <step>`: the minimum amount of shares a security is incremented by (default: "1")

### Create a portfolio with exact value

Calculates the minimum number of shares you need to buy to satisfy your portfolio.

```sh
npm run cli -- target [options] <price>
npm run cli:target -- [options] <price>
```

- Arguments:
  - `price`: target portfolio price (the proposed holdings are never worth more than this)

### Invest amount in portfolio

Calculates the number of shares you need to buy to satisfy your portfolio if you invest additionally

```sh
npm run cli -- invest [options] <investment>
npm run cli:invest -- [options] <investment>
```

- Arguments:
  - `investment`: Additional investment amount
- Options:
  - `-b, --buy-only`: only buy, never sell. The money goes to the most underweight securities first. The investment must be 0 or more.

The plan never needs more than the investment plus the portfolio's `cash`, fees included. "Cash After Trades" shows what's left over. It's negative only for a withdrawal that even selling everything can't cover after fees.

### Rebalance portfolio

Rebalance the current portfolio

```sh
npm run cli -- rebalance [options]
npm run cli:rebalance -- [options]
```

## MCP server

The same operations are available as [Model Context Protocol](https://modelcontextprotocol.io) tools: `show`, `minimal`, `target`, `invest` and `rebalance`. Each tool takes an optional `portfolio` input (`<broker>/<portfolio>`, for example `"ibkr/eur"`; it can be left out when there's only one portfolio) plus the same arguments as its CLI command (`precision`, `sharesStep`, `price`, `investment`, `buyOnly`), and returns structured JSON.

The server reads your portfolios from the folder named by the `STOCK_CALC_DATA_DIR` environment variable (a leading `~` means your home folder). Put your broker folders there; see [Portfolio](#portfolio) for the layout and format. If it isn't set, the server uses `src/data` in its own folder.

You need Node 22 (or newer) and git. The first start takes a while, because npm installs the server and Puppeteer downloads Chrome.

### Use it straight from GitHub (no clone)

`npx` downloads the server from this repository and runs it.

**Claude Code:**

```sh
claude mcp add stock-calc --env STOCK_CALC_DATA_DIR=~/portfolios -- npx -y github:armaaar/stock-calc
```

Add `--scope user` to make it available in every project.

**Claude Desktop, Cursor and other clients** that use a JSON configuration (`claude_desktop_config.json`, `.cursor/mcp.json`, …):

```json
{
  "mcpServers": {
    "stock-calc": {
      "command": "npx",
      "args": ["-y", "github:armaaar/stock-calc"],
      "env": { "STOCK_CALC_DATA_DIR": "~/portfolios" }
    }
  }
}
```

On Windows, some clients can't start `npx` directly. If the server doesn't start, use `"command": "cmd"` with `"args": ["/c", "npx", "-y", "github:armaaar/stock-calc"]`, or add `cmd /c` before `npx` in the `claude mcp add` command.

To pin a version, add a tag, branch or commit after a `#`, for example `github:armaaar/stock-calc#v1.0.0`. npx caches what it downloads, so pinning is also how you pick up updates deliberately.

### Run it from a clone

```sh
git clone https://github.com/armaaar/stock-calc.git
cd stock-calc
npm install
```

Then point the client at the entry point with tsx. Pass `--tsconfig` because clients start the server in another folder, where tsx can't find the project's decorator settings, and the server crashes on start without them:

```json
{
  "mcpServers": {
    "stock-calc": {
      "command": "npx",
      "args": [
        "tsx",
        "--tsconfig", "/path/to/stock-calc/tsconfig.json",
        "/path/to/stock-calc/src/McpApp/app.ts"
      ],
      "env": { "STOCK_CALC_DATA_DIR": "~/portfolios" }
    }
  }
}
```

`node /path/to/stock-calc/bin/stock-calc-mcp.js` works too, and doesn't need `--tsconfig`. Inside the clone, the repository's `.mcp.json` already registers the server for Claude Code, which asks you to approve it the first time you start `claude` there. Without `STOCK_CALC_DATA_DIR`, it reads the portfolios in `src/data`.

Don't use `npm run mcp` in client configurations: npm prints a banner to stdout, which corrupts the protocol stream.

## Development

```sh
npm run typecheck       # tsc (type-check only)
npm run lint            # eslint
npm test                # vitest
npm run test:coverage   # vitest with v8 coverage, fails below 95%
```
