/* eslint-disable no-console */
import { Portfolio } from '@/Entities/Portfolio.Entity'
import { roundPercentage, sortObjectByKey } from '@/Shared/utils'

interface StaticTableData {
  Tick: string
  Exchange: string
  Currency: string
  Price: number
  'Target Percentage %': number
}

interface PerPortfolioTableData {
  Shares: number
  'Total Price': number
  'Percentage %': number
  'Traded Shares'?: number
  'Trading Price'?: number
  'Trading Fee'?: number
}

interface PortfolioSecurityTableData extends StaticTableData, PerPortfolioTableData {}

export enum PresentMode {
  ONLY_NEW = 0,
  ONLY_INITIAL = 1,
  ONLY_DELTA = 2,
  WITH_DELTA = 3,
}

export class PortfolioCliPresenter {
  public static present(
    portfolio: Portfolio,
    mode: PresentMode = PresentMode.ONLY_NEW,
    title?: string,
  ): void {
    const tableData = PortfolioCliPresenter.getTableData(portfolio, mode)

    if (title) console.log(title)
    console.table(tableData)

    if (mode === PresentMode.ONLY_NEW) {
      console.log(`Portfolio Price: ${portfolio.totalPrice} ${portfolio.currency ?? ''}`)
    } else if (mode === PresentMode.ONLY_INITIAL) {
      console.log(`Portfolio Price: ${portfolio.initialTotalPrice} ${portfolio.currency ?? ''}`)
    } else if (mode === PresentMode.ONLY_DELTA) {
      console.log(`Trading Fee: ${portfolio.totalTradingFee} ${portfolio.currency ?? ''}`)
      console.log(`Trading Price: ${portfolio.totalTradedPrice} ${portfolio.currency ?? ''}`)
    } else if (mode === PresentMode.WITH_DELTA) {
      console.log(`Trading Fee: ${portfolio.totalTradingFee} ${portfolio.currency ?? ''}`)
      console.log(`Trading Price: ${portfolio.totalTradedPrice} ${portfolio.currency ?? ''}`)
      console.log(`Portfolio Price: ${portfolio.totalPrice} ${portfolio.currency ?? ''}`)
    } else {
      throw Error(`Unknown present mode '${mode}`)
    }
    console.log()
  }

  protected static getTableData(
    portfolio: Portfolio,
    mode: PresentMode = PresentMode.ONLY_NEW,
  ): PortfolioSecurityTableData[] {
    return portfolio.securities
      .filter((sec) => (mode === PresentMode.ONLY_DELTA ? sec.isBeingTraded : true))
      .map<PortfolioSecurityTableData>((sec) => {
      const infoData: StaticTableData = {
        Tick: sec.tick,
        Exchange: sec.exchange ?? 'Unknown',
        Currency: sec.currency ?? 'Unknown',
        Price: sec.price.toNumber(),
        'Target Percentage %': roundPercentage(sec.targetPercentage.toNumber()),
      }
      let portfolioData: PerPortfolioTableData

      if (mode === PresentMode.ONLY_NEW) {
        portfolioData = {
          Shares: sec.shares,
          'Total Price': sec.totalPrice.toNumber(),
          'Percentage %': roundPercentage(sec.calcActualPercentage(portfolio.totalPrice).toNumber()),
        }
      } else if (mode === PresentMode.ONLY_INITIAL) {
        portfolioData = {
          Shares: sec.initialShares,
          'Total Price': sec.initialTotalPrice.toNumber(),
          'Percentage %': roundPercentage(sec.calcActualPercentage(portfolio.initialTotalPrice, sec.initialTotalPrice).toNumber()),
        }
      } else if (mode === PresentMode.ONLY_DELTA) {
        portfolioData = {
          Shares: sec.shares - sec.initialShares,
          'Total Price': sec.totalPrice.minus(sec.initialTotalPrice).toNumber(),
          'Percentage %': roundPercentage(
            sec.calcActualPercentage(portfolio.totalTradedPrice, sec.tradedPrice).toNumber(),
          ),
          'Trading Fee': sec.tradingFee.toNumber(),
        }
      } else if (mode === PresentMode.WITH_DELTA) {
        portfolioData = {
          Shares: sec.shares,
          'Total Price': sec.totalPrice.toNumber(),
          'Percentage %': roundPercentage(sec.calcActualPercentage(portfolio.totalPrice).toNumber()),
          'Traded Shares': sec.shares - sec.initialShares,
          'Trading Price': sec.tradedPrice.toNumber(),
          'Trading Fee': sec.tradingFee.toNumber(),
        }
      } else {
        throw Error(`Unknown present mode '${mode}`)
      }

      return sortObjectByKey<PortfolioSecurityTableData>({
        ...infoData,
        ...portfolioData,
      }, [
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
      ])
    })
  }
}
