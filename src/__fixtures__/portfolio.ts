import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { IPortfolioSecurity, PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'

/**
 * The tracked example portfolio (`src/data/_settings.EUR.jsonc.example` priced with
 * `_overrides.EUR.jsonc.example`): QDVE 28.45 EUR × 100 @ 40%, SPYD 62.10 EUR × 100 @ 60%,
 * 1 EUR flat brokerage fee. Current value: 9055 EUR.
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

export function buildPortfolio(
  securities: IPortfolioSecurity[] = [QDVE, SPYD],
): Portfolio {
  return new Portfolio({
    securities: securities.map((sec) => new PortfolioSecurity(sec)),
  })
}
