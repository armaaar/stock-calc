import type { IExchangeRate } from '#src/Entities/ExchangeRate.ValueObject'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { IPortfolioSecurity, PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'

/**
 * The tracked example portfolio `ibkr/eur` (`examples/ibkr/eur.jsonc` priced with its
 * overrides): QDVE 28.45 EUR × 100 @ 40%, SPYD 62.10 EUR × 100 @ 60%, 1 EUR flat brokerage fee.
 * Current value: 9055 EUR.
 */
export const QDVE: IPortfolioSecurity = {
  tick: 'QDVE',
  exchange: 'IBIS2',
  isin: 'IE00B3WJKG14',
  currency: 'EUR',
  price: 28.45,
  shares: 100,
  targetPercentage: 0.4,
  brokerageFeeFlat: 1,
  tradingFeePercentage: 0,
  minimumTradingFeeFlat: 0,
}

export const SPYD: IPortfolioSecurity = {
  tick: 'SPYD',
  exchange: 'IBIS2',
  isin: 'IE00B6YX5D40',
  currency: 'EUR',
  price: 62.1,
  shares: 100,
  targetPercentage: 0.6,
  brokerageFeeFlat: 1,
  tradingFeePercentage: 0,
  minimumTradingFeeFlat: 0,
}

/** 1 USD = 0.9 EUR, as tradingview.com quoted it. */
export const USD_EUR: IExchangeRate = {
  from: 'USD',
  to: 'EUR',
  rate: 0.9,
  source: 'tradingview.com',
  quotedAt: '2026-10-06T09:30:00.000Z',
}

/**
 * A USD-listed security in an EUR portfolio: 41.20 USD = 37.08 EUR a share, × 100 @ 60%, with a
 * 1 EUR flat fee and a 0.03% FX fee. With QDVE it makes the mixed example (value 6553 EUR).
 */
export const ICOM: IPortfolioSecurity = {
  tick: 'ICOM',
  exchange: 'LSE',
  currency: 'USD',
  price: 41.2,
  priceSource: 'justetf.com',
  pricedAt: '2026-10-06T09:30:00.000Z',
  shares: 100,
  targetPercentage: 0.6,
  brokerageFeeFlat: 1,
  exchangeRate: USD_EUR,
  fxFeePercentage: 0.0003,
}

export function buildPortfolio(
  securities: IPortfolioSecurity[] = [QDVE, SPYD],
  cash?: number,
): Portfolio {
  return new Portfolio({
    securities: securities.map((sec) => new PortfolioSecurity(sec)),
    cash,
  })
}
