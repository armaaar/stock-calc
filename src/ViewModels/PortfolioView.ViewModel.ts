import Decimal from 'decimal.js'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'
import { roundPercentage } from '#src/Shared/utils'

/** Which state of a planned portfolio to show. */
export enum PresentMode {
  /** The proposed holdings. */
  ONLY_NEW = 0,
  /** The current holdings, ignoring the plan. */
  ONLY_INITIAL = 1,
  /** Only the trades: securities being traded, their trade values and fees. */
  ONLY_DELTA = 2,
  /** The proposed holdings together with their trades and fees. */
  WITH_DELTA = 3,
}

/** One security as an interface shows it. Numbers are plain; percentages are in percent. */
export type SecurityView = {
  tick: string
  exchange?: string
  /** The portfolio's currency, which `price` and every amount are in. */
  currency?: string
  price: number
  /** Listed in another currency only: the quoted price, in `listedCurrency`. */
  listedPrice?: number
  /** Listed in another currency only: the currency it's quoted in. */
  listedCurrency?: string
  /** Listed in another currency only: what one unit of `listedCurrency` is worth. */
  exchangeRate?: number
  /** Where the price came from, such as `justetf.com` or `override`, when known. */
  priceSource?: string
  /**
   * When the price was quoted, when known: an ISO 8601 UTC timestamp, or a date (an override's
   * `asOf`, or a fund's NAV date).
   */
  pricedAt?: string
  /** Target weight in percent. */
  targetPercent: number
  /** Shares held, or traded in `ONLY_DELTA` (negative to sell). */
  shares: number
  /** Value of `shares`. */
  totalPrice: number
  /** Actual weight in percent; in `ONLY_DELTA`, the share of the gross value bought and sold. */
  percent: number
  /** `WITH_DELTA` only: positive to buy, negative to sell. */
  tradedShares?: number
  /** `WITH_DELTA` only: positive to buy, negative to sell. */
  tradedPrice?: number
  /** `ONLY_DELTA` and `WITH_DELTA`. */
  tradingFee?: number
  /** `ONLY_DELTA` and `WITH_DELTA`: the fee as a percentage of the order's value. */
  feePercent?: number
}

/** An exchange rate the plan uses, with where and when it was quoted. */
export type RateView = {
  from: string
  to: string
  /** What one unit of `from` is worth in `to`. */
  rate: number
  source?: string
  /** An ISO 8601 UTC timestamp, or a date for overrides. */
  quotedAt?: string
}

/**
 * A planned portfolio as the interfaces show it, independent of how they render it (CLI table,
 * MCP structured content). Totals a mode doesn't have are left out.
 */
export type PortfolioView = {
  /** The portfolio's id, such as `ibkr/eur`, when it was loaded from the data folder. */
  portfolio?: string
  currency?: string
  securities: SecurityView[]
  /** The exchange rates the prices were converted at, one per pair; left out when none. */
  rates?: RateView[]
  /** Proposed value (`ONLY_NEW`, `WITH_DELTA`) or current value (`ONLY_INITIAL`). */
  portfolioPrice?: number
  /** `ONLY_DELTA`, `WITH_DELTA`: net cash needed (positive) or released (negative). */
  tradedPrice?: number
  /** `ONLY_DELTA`, `WITH_DELTA`. */
  tradingFee?: number
  /** `ONLY_INITIAL`: uninvested cash held now. */
  cash?: number
  /**
   * `ONLY_DELTA`, `WITH_DELTA`: cash left once the plan is carried out (cash held + money added
   * − net traded − fees). Negative: how much more money the plan needs.
   */
  cashAfterTrades?: number
  /**
   * `ONLY_DELTA`, `WITH_DELTA`: one message per order whose fee is more than the portfolio's
   * fee warning percentage of its value.
   */
  warnings?: string[]
}

/** Throws for a value that isn't a `PresentMode` (numeric enums map only real values back). */
export function assertPresentMode(mode: PresentMode): void {
  if (typeof PresentMode[mode] !== 'string') {
    throw Error(`Unknown present mode '${mode}'`)
  }
}

export function toPortfolioView(
  portfolio: Portfolio,
  mode: PresentMode = PresentMode.ONLY_NEW,
): PortfolioView {
  assertPresentMode(mode)

  const securities = toSecurityViews(portfolio, mode)
  const rates = rateViews(portfolio)
  const header = {
    ...(portfolio.id === undefined ? {} : { portfolio: portfolio.id }),
    currency: portfolio.currency,
    securities,
    ...(rates.length === 0 ? {} : { rates }),
  }
  const trades = {
    tradedPrice: portfolio.totalTradedPrice.toNumber(),
    tradingFee: portfolio.totalTradingFee.toNumber(),
    cashAfterTrades: portfolio.cashAfterTrades.toNumber(),
    warnings: feeWarnings(portfolio),
  }

  switch (mode) {
    case PresentMode.ONLY_NEW:
      return { ...header, portfolioPrice: portfolio.totalPrice.toNumber() }
    case PresentMode.ONLY_INITIAL:
      return {
        ...header,
        portfolioPrice: portfolio.initialTotalPrice.toNumber(),
        cash: portfolio.cash.toNumber(),
      }
    case PresentMode.ONLY_DELTA:
      return { ...header, ...trades }
    case PresentMode.WITH_DELTA:
      return { ...header, portfolioPrice: portfolio.totalPrice.toNumber(), ...trades }
  }
}

/** Each exchange rate once, in the order the securities first use it. */
function rateViews(portfolio: Portfolio): RateView[] {
  const rates = new Map<string, RateView>()
  for (const { exchangeRate } of portfolio.securities) {
    if (exchangeRate && !rates.has(exchangeRate.from)) {
      const {
        from, to, rate, source, quotedAt,
      } = exchangeRate.toValues()
      rates.set(from, {
        from, to, rate, source, quotedAt,
      })
    }
  }
  return [...rates.values()]
}

/** A sentence per expensive order, e.g. "QDVE: the 3 EUR fee is 1.06% of the 284.5 EUR order". */
function feeWarnings(portfolio: Portfolio): string[] {
  const money = (value: Decimal) => {
    const amount = value.toDecimalPlaces(2).toNumber()
    return portfolio.currency ? `${amount} ${portfolio.currency}` : `${amount}`
  }
  // The limit exactly as configured, and each share rounded up, so a share just above the limit
  // never reads as equal to it ("1% … (more than 1%)")
  const limit = portfolio.feeWarningPercentage.times(100).toString()
  const percent = (share: Decimal) => share.times(100).toDecimalPlaces(2, Decimal.ROUND_UP)

  return portfolio.expensiveOrders.map((sec) => (
    `${sec.tick}: the ${money(sec.tradingFee)} fee is ${percent(sec.feeShare)}%`
    + ` of the ${money(sec.tradedPrice.abs())} order (more than ${limit}%)`
  ))
}

function toSecurityViews(portfolio: Portfolio, mode: PresentMode): SecurityView[] {
  // Each trade's share of everything bought and sold, so buys and sells don't cancel out
  const grossTradedPrice = portfolio.securities.reduce(
    (acc, sec) => acc.plus(sec.tradedPrice.abs()),
    new Decimal(0),
  )

  return portfolio.securities
    .filter((sec) => (mode === PresentMode.ONLY_DELTA ? sec.isBeingTraded : true))
    .map((sec) => ({
      tick: sec.tick,
      exchange: sec.exchange,
      currency: sec.currency,
      price: sec.price.toNumber(),
      ...(sec.exchangeRate && {
        listedPrice: sec.quote.price.toNumber(),
        listedCurrency: sec.quote.currency,
        exchangeRate: sec.exchangeRate.rate.toNumber(),
      }),
      priceSource: sec.quote.source,
      pricedAt: sec.quote.quotedAt,
      targetPercent: roundPercentage(sec.targetPercentage.toNumber()),
      ...holdingView(portfolio, sec, mode, grossTradedPrice),
    }))
}

function holdingView(
  portfolio: Portfolio,
  sec: PortfolioSecurity,
  mode: PresentMode,
  grossTradedPrice: Decimal,
): Omit<SecurityView, 'tick' | 'exchange' | 'currency' | 'price' | 'listedPrice' | 'listedCurrency' | 'exchangeRate' | 'priceSource' | 'pricedAt' | 'targetPercent'> {
  const proposed = {
    shares: sec.shares,
    totalPrice: sec.totalPrice.toNumber(),
    percent: roundPercentage(sec.calcActualPercentage(portfolio.totalPrice).toNumber()),
  }

  switch (mode) {
    case PresentMode.ONLY_INITIAL:
      return {
        shares: sec.initialShares,
        totalPrice: sec.initialTotalPrice.toNumber(),
        percent: roundPercentage(
          sec.calcActualPercentage(portfolio.initialTotalPrice, sec.initialTotalPrice).toNumber(),
        ),
      }
    case PresentMode.ONLY_DELTA:
      return {
        shares: sec.shares - sec.initialShares,
        totalPrice: sec.tradedPrice.toNumber(),
        percent: roundPercentage(
          sec.calcActualPercentage(grossTradedPrice, sec.tradedPrice.abs()).toNumber(),
        ),
        tradingFee: sec.tradingFee.toNumber(),
        feePercent: roundPercentage(sec.feeShare.toNumber()),
      }
    case PresentMode.WITH_DELTA:
      return {
        ...proposed,
        tradedShares: sec.shares - sec.initialShares,
        tradedPrice: sec.tradedPrice.toNumber(),
        tradingFee: sec.tradingFee.toNumber(),
        feePercent: roundPercentage(sec.feeShare.toNumber()),
      }
    default:
      return proposed
  }
}
