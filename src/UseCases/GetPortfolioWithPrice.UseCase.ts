import { Portfolio_Repository } from "@/Repositories/Portfolio.Repository"


export class GetPortfolioWithPrice {
    
    private _targetPrice: number
    private _portfolioRepo = new Portfolio_Repository()

    constructor(targetPrice: number) {
        this._targetPrice = targetPrice
    }

    public async handler() {
        const portfolio = await this._portfolioRepo.getPortfolio()
        
        for (let i = 0; i < portfolio.securities.length; i++) {
            const sec = portfolio.securities[i];
            const secTargetPrice = this._targetPrice * sec.targetPercentage
            sec.shares = Math.round(secTargetPrice / sec.price)
        }

        return portfolio
    }
}