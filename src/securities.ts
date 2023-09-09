import { ACCEPTABLE_DIFFERENCE, roundPercentage } from "./utils"

export interface AbstractSecurity {
    tick: string
    exchange?: string
    isin: string
    targetPercentage: number
}

export interface PricedAbstractSecurity extends AbstractSecurity {
    price: number
    currency?: string
}

export class Security implements PricedAbstractSecurity {
    public tick: string
    public isin: string
    public exchange?: string
    public currency?: string
    public price: number
    public targetPercentage: number
    private _shares: number = NaN

    public get shares(): number {
        return Math.round(this._shares)
    }

    public set shares(sh: number) {
        this._shares = sh
    }

    constructor(options: PricedAbstractSecurity) {
        const {tick, exchange, isin, price, currency, targetPercentage} = options
        if (!tick) {
            throw('Tick can\'t be empty')
        }
        this.tick = tick
        if (!isin) {
            throw('ISIN can\'t be empty')
        }
        this.isin = isin
        this.exchange = exchange
        this.currency = currency

        if (price < 0) {
            throw('Price can\'t be < 0 or > 1')
        }
        this.price = price
        this.currency = currency

        if (targetPercentage < 0 || targetPercentage > 1) {
            throw('Percentage can\'t be < 0 or > 1 ')
        }
        this.targetPercentage = targetPercentage
    }

    public get isValid(): boolean {
        return !isNaN(this.shares) && (Math.abs(this._shares - this.shares) <= ACCEPTABLE_DIFFERENCE)
    }

    public get totalPrice(): number {
        return this.price * this.shares
    }

    public calcActualPercentage(actualPrice: number) {
        return this.totalPrice / actualPrice
    }

    public log(actualPrice?: number): void {
        console.log(`------------------------ ${this.tick}${this.exchange ? ` @ ${this.exchange}` : ''} ------------------------`)
        console.log(`Price: ${this.price}`)
        console.log(`Shares: ${this.shares}`)
        console.log(`Total Price: ${this.totalPrice}`)
        if (![undefined, NaN, 0].includes(actualPrice)) {
            console.log(`Percentage: ${roundPercentage(this.calcActualPercentage(actualPrice!))}`)
        }
    }
}