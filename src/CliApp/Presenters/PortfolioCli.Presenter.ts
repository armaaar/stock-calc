/* eslint-disable no-console */
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { sortObjectByKey } from '#src/Shared/utils'
import {
  PortfolioView, PresentMode, SecurityView, toPortfolioView,
} from '#src/ViewModels/PortfolioView.ViewModel'

export { PresentMode }

interface PortfolioSecurityTableData {
  'Tick': string
  'Exchange': string
  'Currency': string
  'Price': number
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
  'Currency',
  'Price',
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
    console.table(view.securities.map((sec) => PortfolioCliPresenter.toRow(sec)))
    PortfolioCliPresenter.getTotals(view).forEach((line) => console.log(line))
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

  /**
   * Where and when the price was quoted: a timestamp to the minute in UTC
   * ("justetf.com 2026-10-06 09:30"), or a date as given ("override 2026-10-01").
   */
  protected static quoteOf({ priceSource, pricedAt }: SecurityView): string | undefined {
    if (!priceSource) return undefined
    if (!pricedAt) return priceSource
    return `${priceSource} ${pricedAt.slice(0, 16).replace('T', ' ')}`
  }

  /** One table row; columns the mode doesn't have are left out (they're undefined). */
  protected static toRow(sec: SecurityView): PortfolioSecurityTableData {
    return sortObjectByKey<PortfolioSecurityTableData>({
      'Tick': sec.tick,
      'Exchange': sec.exchange ?? 'Unknown',
      'Currency': sec.currency ?? 'Unknown',
      'Price': sec.price,
      'Quote': PortfolioCliPresenter.quoteOf(sec),
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
