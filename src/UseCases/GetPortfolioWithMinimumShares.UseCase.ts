import {
  IsInt, IsNumber, IsPositive, Max, Min,
} from 'class-validator'
import Decimal from 'decimal.js'
import { PortfolioSecurity } from '#src/Entities/PortfolioSecurity.Entity'
import { roundToClosestMultiply } from '#src/Shared/utils'
import { validateClassErrors } from '#src/Shared/ClassValidatorError'
import { PortfolioRequest, PortfolioUseCase } from './PortfolioUseCase.abstract'

export const DEFAULT_ACCEPTABLE_PRECISION = 0.01
export const DEFAULT_SHARES_STEP = 1
export const MAX_SEARCH_ITERATIONS = 100_000

export interface MinimumSharesRequest extends PortfolioRequest {
  /** How far each security's weight may be from its target (a fraction); default 0.01. */
  acceptablePrecision?: number
  /** Shares are bought in multiples of this; default 1. */
  sharesStep?: number
}

/** Validated search options, with defaults for the values that weren't given. */
export class MinimumSharesSearch {
  @IsNumber()
  @IsPositive()
  @Max(1)
  public readonly acceptablePrecision: number

  @IsInt()
  @Min(1)
  public readonly sharesStep: number

  constructor(acceptablePrecision?: number, sharesStep?: number) {
    this.acceptablePrecision = acceptablePrecision ?? DEFAULT_ACCEPTABLE_PRECISION
    this.sharesStep = sharesStep ?? DEFAULT_SHARES_STEP

    validateClassErrors(this, MinimumSharesSearch)
  }
}

export class GetPortfolioWithMinimumSharesUseCase extends PortfolioUseCase<MinimumSharesRequest> {
  protected maxIterations = MAX_SEARCH_ITERATIONS

  public async execute({ portfolioType, acceptablePrecision, sharesStep }: MinimumSharesRequest) {
    const search = new MinimumSharesSearch(acceptablePrecision, sharesStep)
    const portfolio = await this.portfolioRepo.getPortfolio(portfolioType)

    // Drive the search from a security that must be held: scaling from a 0 target divides by 0
    const driver = portfolio.securities.find((sec) => sec.targetPercentage.greaterThan(0))
    if (!driver) throw Error('Portfolio has no security with a target percentage above 0')

    for (let iteration = 1; iteration <= this.maxIterations; iteration++) {
      driver.shares = iteration * search.sharesStep
      portfolio.securities.forEach((sec) => {
        if (sec === driver) return
        sec.shares = sec.targetPercentage.isZero()
          ? 0
          : roundToClosestMultiply(this.calcShares(driver, sec), search.sharesStep)
      })

      const totalPrice = portfolio.totalPrice
      const isPrecise = (sec: PortfolioSecurity) => (
        this.areSharesPrecise(sec, totalPrice, search.acceptablePrecision)
      )
      if (portfolio.securities.every(isPrecise)) {
        return portfolio
      }
    }

    throw Error(
      `No portfolio within precision ${search.acceptablePrecision} found in ${this.maxIterations} iterations`,
    )
  }

  private calcShares(knownTick: PortfolioSecurity, targetTick: PortfolioSecurity): number {
    return knownTick.price
      .times(knownTick.shares)
      .dividedBy(knownTick.targetPercentage)
      .times(targetTick.targetPercentage)
      .dividedBy(targetTick.price)
      .round()
      .toNumber()
  }

  private areSharesPrecise(
    sec: PortfolioSecurity,
    totalPrice: Decimal,
    acceptablePrecision: number,
  ): boolean {
    return sec.calcActualPercentage(totalPrice)
      .minus(sec.targetPercentage)
      .abs()
      .lessThanOrEqualTo(acceptablePrecision)
  }
}
