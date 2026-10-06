/* eslint-disable no-console */
import Decimal from 'decimal.js'
import { Portfolio } from '#src/Entities/Portfolio.Entity'
import { PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'
import { roundPercentage, sortObjectByKey } from '#src/Shared/utils'

interface StaticTableData {
  'Tick': string
  'Exchange': string
  'Currency': string
  'Price': number
  'Target Percentage %': number
}

interface PerPortfolioTableData {
  'Shares': number
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
    // Numeric enum: only real values map back to a name (PresentMode[0] === 'ONLY_NEW')
    if (typeof PresentMode[mode] !== 'string') {
      throw Error(`Unknown present mode '${mode}'`)
    }

    const tableData = PortfolioCliPresenter.getTableData(portfolio, mode)

    if (title) console.log(title)
    console.table(tableData)
    PortfolioCliPresenter.getTotals(portfolio, mode).forEach((line) => console.log(line))
    console.log()
  }

  protected static getTotals(portfolio: Portfolio, mode: PresentMode): string[] {
    const amount = (value: Decimal) => (
      portfolio.currency ? `${value} ${portfolio.currency}` : String(value)
    )
    const fee = `Trading Fee: ${amount(portfolio.totalTradingFee)}`
    const traded = `Trading Price: ${amount(portfolio.totalTradedPrice)}`

    switch (mode) {
      case PresentMode.ONLY_NEW:
        return [`Portfolio Price: ${amount(portfolio.totalPrice)}`]
      case PresentMode.ONLY_INITIAL:
        return [`Portfolio Price: ${amount(portfolio.initialTotalPrice)}`]
      case PresentMode.ONLY_DELTA:
        return [fee, traded]
      case PresentMode.WITH_DELTA:
        return [fee, traded, `Portfolio Price: ${amount(portfolio.totalPrice)}`]
    }
  }

  protected static getTableData(
    portfolio: Portfolio,
    mode: PresentMode = PresentMode.ONLY_NEW,
  ): PortfolioSecurityTableData[] {
    // Each trade's share of everything bought and sold, so buys and sells don't cancel out
    const grossTradedPrice = portfolio.securities.reduce(
      (acc, sec) => acc.plus(sec.tradedPrice.abs()),
      new Decimal(0),
    )

    return portfolio.securities
      .filter((sec) => (mode === PresentMode.ONLY_DELTA ? sec.isBeingTraded : true))
      .map<PortfolioSecurityTableData>((sec) => sortObjectByKey<PortfolioSecurityTableData>({
        'Tick': sec.tick,
        'Exchange': sec.exchange ?? 'Unknown',
        'Currency': sec.currency ?? 'Unknown',
        'Price': sec.price.toNumber(),
        'Target Percentage %': roundPercentage(sec.targetPercentage.toNumber()),
        ...PortfolioCliPresenter.getPortfolioData(portfolio, sec, mode, grossTradedPrice),
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
      ]))
  }

  private static getPortfolioData(
    portfolio: Portfolio,
    sec: PortfolioSecurity,
    mode: PresentMode,
    grossTradedPrice: Decimal,
  ): PerPortfolioTableData {
    switch (mode) {
      case PresentMode.ONLY_NEW:
        return {
          'Shares': sec.shares,
          'Total Price': sec.totalPrice.toNumber(),
          'Percentage %': roundPercentage(sec.calcActualPercentage(portfolio.totalPrice).toNumber()),
        }
      case PresentMode.ONLY_INITIAL:
        return {
          'Shares': sec.initialShares,
          'Total Price': sec.initialTotalPrice.toNumber(),
          'Percentage %': roundPercentage(
            sec.calcActualPercentage(portfolio.initialTotalPrice, sec.initialTotalPrice).toNumber(),
          ),
        }
      case PresentMode.ONLY_DELTA:
        return {
          'Shares': sec.shares - sec.initialShares,
          'Total Price': sec.tradedPrice.toNumber(),
          'Percentage %': roundPercentage(
            sec.calcActualPercentage(grossTradedPrice, sec.tradedPrice.abs()).toNumber(),
          ),
          'Trading Fee': sec.tradingFee.toNumber(),
        }
      case PresentMode.WITH_DELTA:
        return {
          'Shares': sec.shares,
          'Total Price': sec.totalPrice.toNumber(),
          'Percentage %': roundPercentage(sec.calcActualPercentage(portfolio.totalPrice).toNumber()),
          'Traded Shares': sec.shares - sec.initialShares,
          'Trading Price': sec.tradedPrice.toNumber(),
          'Trading Fee': sec.tradingFee.toNumber(),
        }
    }
  }
}
