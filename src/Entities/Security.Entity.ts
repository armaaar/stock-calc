import { validateClassErrors } from "@/Shared/utils"
import { IsNotEmpty, Min } from "class-validator"


export interface ISecurety {
    tick: string
    isin: string
    price: number
    exchange?: string
    currency?: string
}

export class Security {
    @IsNotEmpty()
    public tick: string

    @IsNotEmpty()
    public isin: string

    @Min(0)
    public price: number

    public exchange?: string
    public currency?: string

    constructor({tick, isin , price, exchange, currency}: ISecurety) {
        this.tick = tick
        this.isin = isin
        this.price = price
        this.exchange = exchange
        this.currency = currency

        validateClassErrors(this, Security)
    }
}