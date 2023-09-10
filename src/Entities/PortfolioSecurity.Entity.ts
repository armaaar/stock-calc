import { validateClassErrors } from "@/Shared/utils"
import { IsInt, Max, Min } from "class-validator"
import { ISecurety, Security } from "./Security.Entity"

interface IPortfolioSecurity extends ISecurety {
    shares: number
    targetPercentage: number
}

export class PortfolioSecurity extends Security {
    @Min(0)
    @Max(1)
    public targetPercentage: number

    @IsInt()
    @Min(0)
    public shares: number

    constructor(args: IPortfolioSecurity) {
        super(args)
        this.shares = args.shares
        this.targetPercentage = args.targetPercentage

        validateClassErrors(this, PortfolioSecurity)
    }

    public get totalPrice(): number {
        return this.price * this.shares
    }

    public calcActualPercentage(actualPrice: number) {
        return this.totalPrice / actualPrice
    }
}