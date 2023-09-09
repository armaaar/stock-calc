import { PortfolioSecurity } from "@/Entities/PortfolioSecurity.Entity"
import { Portfolio_Repository } from "@/Repositories/Portfolio.Repository"
import { roundToClosestMultiply, validateClassErrors } from "@/Shared/utils"
import { IsInt, Max, Min } from "class-validator"

export const DEFAULT_ACCEPTABLE_PERCESION = 0.01
export const DEFAULT_SHARES_STEP = 1

export class GetPortfolioWithMinimumShares_UseCase {
    
    @Min(0)
    @Max(1)
    private _acceptablePercision: number = DEFAULT_ACCEPTABLE_PERCESION

    @IsInt()
    @Min(1)
    private _sharesStep: number = DEFAULT_SHARES_STEP


    private _portfolioRepo = new Portfolio_Repository()

    constructor(acceptablePercision?: number, sharesStep?: number) {
        if (acceptablePercision) this._acceptablePercision = acceptablePercision
        if (sharesStep) this._sharesStep = sharesStep
        
        validateClassErrors(this, GetPortfolioWithMinimumShares_UseCase)
    }

    public async handler() {
        const portfolio = await this._portfolioRepo.getPortfolio()

        let initialNumberOfTShares = this._sharesStep

        while(!portfolio.securities.every((sec) => this._areSharesPercise(sec, portfolio.totalPrice))) {
            const assumedSec = portfolio.securities[0]
            assumedSec.shares = initialNumberOfTShares
            initialNumberOfTShares += this._sharesStep
            for (let index = 1; index < portfolio.securities.length; index++) {
                const sec = portfolio.securities[index]
                sec.shares = roundToClosestMultiply(this._calcShares(assumedSec, sec), this._sharesStep)
            }
        }

        return portfolio
    }

    private _calcShares(knownTick: PortfolioSecurity, targetTick: PortfolioSecurity): number {
        return Math.round((knownTick.price * knownTick.shares / knownTick.targetPercentage) / (targetTick.price / targetTick.targetPercentage))
    }

    private _areSharesPercise(sec: PortfolioSecurity, totalPrice: number): boolean {
        return Math.abs(sec.calcActualPercentage(totalPrice) - sec.targetPercentage) <= this._acceptablePercision
    }
}