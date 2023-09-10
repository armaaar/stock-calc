import { Portfolio_Repository } from "@/Repositories/Portfolio.Repository"


export class GetCurrentPortfolio_UseCase {
    
    private _portfolioRepo = new Portfolio_Repository()

    public async handler() {
        return await this._portfolioRepo.getPortfolio()
    }
}