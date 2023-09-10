import { IsInt, Max, Min } from 'class-validator'
import { PortfolioSecurity } from '@/Entities/PortfolioSecurity.Entity'
import { PortfolioRepository } from '@/Repositories/Portfolio.Repository'
import { roundToClosestMultiply } from '@/Shared/utils'
import { validateClassErrors } from '@/Shared/classValidatorError'

export const DEFAULT_ACCEPTABLE_PERCESION = 0.01
export const DEFAULT_SHARES_STEP = 1

export class GetPortfolioWithMinimumSharesUseCase {
  @Min(0)
  @Max(1)
  private acceptablePercision: number = DEFAULT_ACCEPTABLE_PERCESION

  @IsInt()
  @Min(1)
  private sharesStep: number = DEFAULT_SHARES_STEP

  private portfolioRepo = new PortfolioRepository()

  constructor(acceptablePercision?: number, sharesStep?: number) {
    if (acceptablePercision) this.acceptablePercision = acceptablePercision
    if (sharesStep) this.sharesStep = sharesStep

    validateClassErrors(this, GetPortfolioWithMinimumSharesUseCase)
  }

  public async handler() {
    const portfolio = await this.portfolioRepo.getPortfolio()

    let initialNumberOfTShares = this.sharesStep

    while (!portfolio.securities.every(
      (sec) => this.areSharesPercise(sec, portfolio.totalPrice),
    )) {
      const assumedSec = portfolio.securities[0]
      assumedSec.shares = initialNumberOfTShares
      initialNumberOfTShares += this.sharesStep
      for (let index = 1; index < portfolio.securities.length; index++) {
        const sec = portfolio.securities[index]
        sec.shares = roundToClosestMultiply(this.calcShares(assumedSec, sec), this.sharesStep)
      }
    }

    return portfolio
  }

  private calcShares(knownTick: PortfolioSecurity, targetTick: PortfolioSecurity): number {
    return Math.round(
      ((knownTick.price * knownTick.shares) / knownTick.targetPercentage)
      / (targetTick.price / targetTick.targetPercentage),
    )
  }

  private areSharesPercise(sec: PortfolioSecurity, totalPrice: number): boolean {
    return Math.abs(
      sec.calcActualPercentage(totalPrice) - sec.targetPercentage,
    ) <= this.acceptablePercision
  }
}
