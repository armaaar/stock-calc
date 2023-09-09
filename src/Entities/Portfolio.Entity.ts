import { Min } from "class-validator"
import { PortfolioSecurity } from "./PortfolioSecurity.Entity"


export class Portfolio {
    @Min(1)
    public securities: PortfolioSecurity[]
    // TODO: Add currency


    constructor(securities: PortfolioSecurity[]) {
        const totalPercentage = securities.reduce((acc, sec) => acc + sec.targetPercentage, 0)
        if (totalPercentage != 1) {
            throw('Portfolio percentage don\'t add up to 1')
        }

        // TODO: Add test that all currencies are the same

        this.securities = securities
    }
    
    public get totalPrice(): number {
        return this.securities.reduce((acc, sec) => acc + sec.totalPrice, 0)
    }
}