# Stocks Calculator

This is a small tool to help calculate your stock investments. Use it from the command line, or let an AI assistant use it through its [MCP server](#mcp-server).

## Setup

Requires Node 22 (see `.nvmrc`).

```sh
npm install
npx puppeteer browsers install chrome   # only if npm install didn't download Chrome
```

## Portfolio

The tool allows multiple portfolios to be chosen from. Portfolios are supplied in JSON format. It uses `.jsonc` extension to allow comments.

To create a new portfolio, create a portfolio file under `src/data` named `_settings.<portfolio_name>.jsonc`. Portfolio names may only contain letters, digits, `_` and `-`.

A portfolio object contains:

- `brokerageFeeFlat`: A flat amount of money the brokage take on each order. It's added to each order no matter what the value is.
- `tradingFeePercentage`: The trading fee is taken as a percentage of the total order value.
- `minimumTradingFeeFlat`: The minimum amount of trading fee that is taken.
- `securities`: A list of securities in a portfolio.

The `securities` list consists of security objects, which contains:

- `tick`: The tick of the security.
- `exchange`: The exchange symbol for the security, used with the tick to determine the correct security.
- `shares`: The number of shares the portfolio have of this security.
- `targetPercentage`: The percentage this security contributes to in the portfolio. Must be 1 or less.
- `isin`: (Optional) An [International Securities Identification Number (ISIN)](https://en.wikipedia.org/wiki/International_Securities_Identification_Number) is a 12-digit alphanumeric code that uniquely identifies a specific security. Can be used to find the security.

The price of each security is fetched automatically from public records using either the combination of the tick and exchange, or using the isin if available.

### Price overrides

To skip fetching for some securities (for example, when no source lists them), create `src/data/_overrides.<portfolio_name>.jsonc`, keyed by tick:

```jsonc
{
  "QDVE": { "price": 28.45, "currency": "EUR" }
}
```

The override currency must match the rest of the portfolio. See `src/data/*.jsonc.example` for templates.

## Documentation

Architecture, decision records, and domain docs are in [`docs/`](docs/README.md).

## Available operations

The tool can be used by running:

```sh
npm run cli -- <command> [options]
```

This is a list of global options available in all operations

- `--pt, --portfolio <type>`: the portfolio to use (default: "EUR")
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
  - `price`: target portfolio price

### Invest amount in portfolio

Calculates the number of shares you need to buy to satisfy your portfolio if you invest additionally

```sh
npm run cli -- invest [options] <investment>
npm run cli:invest -- [options] <investment>
```

- Arguments:
  - `investment`: Additional investment amount

### Rebalance portfolio

Rebalance the current portfolio

```sh
npm run cli -- rebalance [options]
npm run cli:rebalance -- [options]
```

## MCP server

The same operations are available as [Model Context Protocol](https://modelcontextprotocol.io) tools: `show`, `minimal`, `target`, `invest` and `rebalance`. Each tool takes a `portfolio` input (default `"EUR"`) plus the same arguments as its CLI command (`precision`, `sharesStep`, `price`, `investment`), and returns structured JSON.

The server reads your portfolios from the folder named by the `STOCK_CALC_DATA_DIR` environment variable (a leading `~` means your home folder). Put your `_settings.<portfolio_name>.jsonc` and optional `_overrides.<portfolio_name>.jsonc` files there; see [Portfolio](#portfolio) for the format. If it isn't set, the server uses `src/data` in its own folder.

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

Then point the client at the entry point with tsx. Pass `--tsconfig` because clients start the server in another folder, and without it tsx can't resolve the project's imports:

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
