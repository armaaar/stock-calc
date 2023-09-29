/* eslint-disable no-console */
import { Portfolio } from '@/Entities/Portfolio.Entity'
import { roundPercentage } from '@/Shared/utils'

interface PortfolioSecurityTableData {
  Tick: string
  Exchange: string
  Currency: string
  Price: number
  Shares: number
  'Total Price': number
  'Percentage %': number
  'Target Percentage %': number
}

export class PortfolioCliPresenter {
  public static present(portfolio: Portfolio, title?: string): void {
    const tableData = portfolio.securities.map<PortfolioSecurityTableData>((sec) => ({
      Tick: sec.tick,
      Exchange: sec.exchange ?? 'Unknown',
      Currency: sec.currency ?? 'Unknown',
      Price: sec.price.toNumber(),
      Shares: sec.shares,
      'Total Price': sec.totalPrice.toNumber(),
      'Percentage %': roundPercentage(sec.calcActualPercentage(portfolio.totalPrice).toNumber()),
      'Target Percentage %': roundPercentage(sec.targetPercentage.toNumber()),
    }))

    if (title) console.log(title)
    console.table(tableData)
    console.log(`Portfolio Price: ${portfolio.totalPrice} ${portfolio.currency ?? ''}`)
    console.log()
  }
}
