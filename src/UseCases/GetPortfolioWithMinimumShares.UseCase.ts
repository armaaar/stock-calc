import { PortfolioSecurity } from "@/Entities/PortfolioSecurity.Entity"
import { Portfolio_Repository } from "@/Repositories/Portfolio.Repository"

export const DEFAULT_ACCEPTABLE_PERCESION = 0.01

export class GetPortfolioWithMinimumShares {
    
    private _acceptablePercision = DEFAULT_ACCEPTABLE_PERCESION
    private _portfolioRepo = new Portfolio_Repository()

    constructor(acceptablePercision?: number) {
        if (acceptablePercision) this._acceptablePercision = acceptablePercision
    }

    public async handler() {
        const portfolio = await this._portfolioRepo.getPortfolio()

        let initialNumberOfTShares = 1

        while(!portfolio.securities.every((sec) => this._areSharesPercise(sec, portfolio.totalPrice))) {
            const assumedSec = portfolio.securities[0]
            assumedSec.shares = initialNumberOfTShares++
            for (let index = 1; index < portfolio.securities.length; index++) {
                const sec = portfolio.securities[index]
                sec.shares = this._calcShares(assumedSec, sec)
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