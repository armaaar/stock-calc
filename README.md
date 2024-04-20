# Stocks Calculator

This is a small tool to help calculate your stock investments.

## Portfolio

The tool allows multiple portfolios to be chosen from. Portfolios are supplied in JSON format. It uses `.jsonc` extension to allow comments.

To create a new portfolio, create a portfolio file under `src/data` named `_settings.<portfolio_name>.jsonc`.

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

## Available operations

The tool can be used by running:

```sh
npm run cli -- <command> [options]
```

This is a list of global options available in all operations

- `-pt, --portfolio <type>`: the portfolio to use (default: "EUR")
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
