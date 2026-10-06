/* eslint-disable no-console */
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { sortObjectByKey } from '#src/Shared/utils'
import {
  PortfolioView, PresentMode, RateView, SecurityView, toPortfolioView,
} from '#src/ViewModels/PortfolioView.ViewModel'

export { PresentMode }

interface PortfolioSecurityTableData {
  'Tick': string
  'Exchange': string
  'Price': number
  'Listed'?: string
  'Quote'?: string
  'Shares': number
  'Total Price': number
  'Percentage %': number
  'Target Percentage %': number
  'Traded Shares'?: number
  'Trading Price'?: number
  'Trading Fee'?: number
  'Fee %'?: number
}

const COLUMNS: (keyof PortfolioSecurityTableData)[] = [
  'Tick',
  'Exchange',
  'Price',
  'Listed',
  'Quote',
  'Shares',
  'Total Price',
  'Percentage %',
  'Target Percentage %',
  'Traded Shares',
  'Trading Price',
  'Trading Fee',
  'Fee %',
]

/** Renders a `PortfolioView` as a `console.table` plus total lines. */
export class PortfolioCliPresenter {
  public static present(
    portfolio: Portfolio,
    mode: PresentMode = PresentMode.ONLY_NEW,
    title?: string,
  ): void {
    const view = toPortfolioView(portfolio, mode)

    if (title) console.log(title)
    const heading = PortfolioCliPresenter.headingOf(view)
    if (heading) console.log(heading)
    // console.table orders columns as the rows first have them: when some security is listed in
    // another currency, every row gets a 'Listed' cell, so the column stays beside 'Price'
    const listed = view.securities.some((sec) => sec.listedPrice !== undefined)
    console.table(view.securities.map((sec) => PortfolioCliPresenter.toRow(sec, listed)))
    PortfolioCliPresenter.getTotals(view).forEach((line) => console.log(line))
    view.rates?.forEach((rate) => console.log(PortfolioCliPresenter.rateLine(rate)))
    view.warnings?.forEach((warning) => console.log(`Warning: ${warning}`))
    console.log()
  }

  /** A line per total the view has, in a fixed order. */
  protected static getTotals(view: PortfolioView): string[] {
    const totals: [string, number | undefined][] = [
      ['Trading Fee', view.tradingFee],
      ['Trading Price', view.tradedPrice],
      ['Portfolio Price', view.portfolioPrice],
      ['Cash', view.cash],
      ['Cash After Trades', view.cashAfterTrades],
    ]

    return totals
      .filter((total): total is [string, number] => total[1] !== undefined)
      .map(([label, value]) => (
        view.currency ? `${label}: ${value} ${view.currency}` : `${label}: ${value}`
      ))
  }

  /** The portfolio and the currency everything is in: "ibkr/eur (EUR)". */
  protected static headingOf({ portfolio, currency }: PortfolioView): string | undefined {
    if (!portfolio) return undefined
    return currency ? `${portfolio} (${currency})` : portfolio
  }

  /**
   * Where and when a price or rate was quoted: a timestamp to the minute in UTC
   * ("justetf.com 2026-10-06 09:30"), or a date as given ("override 2026-10-01").
   */
  protected static sourceOf(source?: string, quotedAt?: string): string | undefined {
    if (!source) return undefined
    if (!quotedAt) return source
    return `${source} ${quotedAt.slice(0, 16).replace('T', ' ')}`
  }

  /** "Rate: USD/EUR 0.8877 (tradingview.com 2026-10-06 09:30)". */
  protected static rateLine({
    from, to, rate, source, quotedAt,
  }: RateView): string {
    const quoted = PortfolioCliPresenter.sourceOf(source, quotedAt)
    return `Rate: ${from}/${to} ${rate}${quoted ? ` (${quoted})` : ''}`
  }

  /** The price as listed and the rate it was converted at: "41.2 USD @ 0.9". */
  protected static listedOf(sec: SecurityView): string {
    if (sec.listedPrice === undefined) return ''
    return `${sec.listedPrice} ${sec.listedCurrency} @ ${sec.exchangeRate}`
  }

  /**
   * One table row; columns the mode doesn't have are left out (they're undefined), and so is
   * 'Listed' unless `listed`.
   */
  protected static toRow(sec: SecurityView, listed: boolean): PortfolioSecurityTableData {
    return sortObjectByKey<PortfolioSecurityTableData>({
      'Tick': sec.tick,
      'Exchange': sec.exchange ?? 'Unknown',
      'Price': sec.price,
      'Listed': listed ? PortfolioCliPresenter.listedOf(sec) : undefined,
      'Quote': PortfolioCliPresenter.sourceOf(sec.priceSource, sec.pricedAt),
      'Shares': sec.shares,
      'Total Price': sec.totalPrice,
      'Percentage %': sec.percent,
      'Target Percentage %': sec.targetPercent,
      'Traded Shares': sec.tradedShares,
      'Trading Price': sec.tradedPrice,
      'Trading Fee': sec.tradingFee,
      'Fee %': sec.feePercent,
    }, COLUMNS)
  }
}
