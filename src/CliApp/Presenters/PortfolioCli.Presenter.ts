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
  'Shares': number
  'Total Price': number
  'Percentage %': number
  'Target Percentage %': number
  'Traded Shares'?: number
  'Trading Price'?: number
  'Trading Fee'?: number
}

const COLUMNS: (keyof PortfolioSecurityTableData)[] = [
  'Tick',
  'Exchange',
  'Currency',
  'Price',
  'Shares',
  'Total Price',
  'Percentage %',
  'Target Percentage %',
  'Traded Shares',
  'Trading Price',
  'Trading Fee',
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
    console.log()
  }

  /** A line per total the view has, in a fixed order. */
  protected static getTotals(view: PortfolioView): string[] {
    const totals: [string, number | undefined][] = [
      ['Trading Fee', view.tradingFee],
      ['Trading Price', view.tradedPrice],
      ['Portfolio Price', view.portfolioPrice],
    ]

    return totals
      .filter((total): total is [string, number] => total[1] !== undefined)
      .map(([label, value]) => (
        view.currency ? `${label}: ${value} ${view.currency}` : `${label}: ${value}`
      ))
  }

  /** One table row; columns the mode doesn't have are left out (they're undefined). */
  protected static toRow(sec: SecurityView): PortfolioSecurityTableData {
    return sortObjectByKey<PortfolioSecurityTableData>({
      'Tick': sec.tick,
      'Exchange': sec.exchange ?? 'Unknown',
      'Currency': sec.currency ?? 'Unknown',
      'Price': sec.price,
      'Shares': sec.shares,
      'Total Price': sec.totalPrice,
      'Percentage %': sec.percent,
      'Target Percentage %': sec.targetPercent,
      'Traded Shares': sec.tradedShares,
      'Trading Price': sec.tradedPrice,
      'Trading Fee': sec.tradingFee,
    }, COLUMNS)
  }
}
