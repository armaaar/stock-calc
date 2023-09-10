/* eslint-disable no-console */
import { Portfolio } from '@/Entities/Portfolio.Entity';
import { roundPercentage } from '@/Shared/utils';

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
  public static present(portfolio: Portfolio): void {
    const tableData = portfolio.securities.map<PortfolioSecurityTableData>((sec) => ({
      Tick: sec.tick,
      Exchange: sec.exchange ?? 'Unknown',
      Currency: sec.currency ?? 'Unknown',
      Price: sec.price,
      Shares: sec.shares,
      'Total Price': sec.totalPrice,
      'Percentage %': roundPercentage(sec.calcActualPercentage(portfolio.totalPrice)),
      'Target Percentage %': roundPercentage(sec.targetPercentage),
    }))

    console.table(tableData)
    console.log(`Portfolio Price: ${portfolio.totalPrice} ${portfolio.currency ?? ''}`);
  }
}
