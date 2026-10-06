# Example portfolios

A complete data folder, with two brokers. Every price and rate in it is overridden, so it runs offline:

```sh
STOCK_CALC_DATA_DIR=examples npm run cli -- rebalance --pt ibkr/eur
STOCK_CALC_DATA_DIR=examples npm run cli -- rebalance --pt ibkr/mixed
STOCK_CALC_DATA_DIR=examples npm run cli -- invest 500 --pt thndr/egp
```

To start your own, copy a broker folder into `src/data` (or into the folder `STOCK_CALC_DATA_DIR` names), rename it after your broker, and edit it. Everything in `src/data` is git-ignored.

```
examples/
  ibkr/
    _broker.jsonc          fees every IBKR portfolio shares, including the FX fee
    eur.jsonc              ibkr/eur: a EUR portfolio, fees from _broker.jsonc
    eur.overrides.jsonc    its prices, so it runs offline
    mixed.jsonc            ibkr/mixed: pays in EUR for a security traded in USD
    mixed.overrides.jsonc  its prices, and the USD/EUR rate
  thndr/
    _broker.jsonc          Thndr's tariff
    egp.jsonc              thndr/egp: cash, and one security with its own minimum fee
    egp.overrides.jsonc    its prices, one of them dated
```

| File | Shows |
| --- | --- |
| `ibkr/_broker.jsonc` | Settings a broker's portfolios share: the fee parts and `fxFeePercentage`. |
| `ibkr/eur.jsonc` | The smallest portfolio: just `securities`. Its fees come from the broker. |
| `ibkr/mixed.jsonc` | `currency` (what orders are paid in), and a security's own `currency` (what it trades in). CSPX is converted from USD, and its orders pay the FX fee. |
| `ibkr/mixed.overrides.jsonc` | Price overrides by tick, and a rate override by `<FROM>/<TO>`. Remove the rate to fetch it live. |
| `thndr/egp.jsonc` | `cash`, and a fee part set on one security. |
| `thndr/egp.overrides.jsonc` | `asOf`: when a price was looked up. |

The [README](../README.md#portfolio) describes every field.
