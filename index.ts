const ACCEPTABLE_DIFFERENCE = 0.2

function roundPercentage(percentage: number) {
    return Math.round(percentage * 10000) / 100
}

interface AbstractSecurity {
    tick: string
    price: number
    percentage: number
}

class Security implements AbstractSecurity {
    public tick: string
    public price: number
    public percentage: number
    private _shares: number = NaN

    public get shares(): number {
        return Math.round(this._shares)
    }

    public set shares(sh: number) {
        this._shares = sh
    }

    constructor(options: {tick: string, price: number, percentage: number, shares?: number}) {
        const {tick, price, percentage, shares} = options
        if (!tick) {
            throw('Tick can\'t be empty')
        }
        this.tick = tick

        if (price < 0) {
            throw('Price can\'t be < 0 or > 1')
        }
        this.price = price

        if (percentage < 0 || percentage > 1) {
            throw('Percentage can\'t be < 0 or > 1 ')
        }
        this.percentage = percentage

        this.shares = shares ?? NaN
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
        console.log(`------------------------ ${this.tick} ------------------------`)
        console.log(`Price: ${this.price}`)
        console.log(`Shares: ${this.shares}`)
        console.log(`Total Price: ${this.totalPrice}`)
        if (![undefined, NaN, 0].includes(actualPrice)) {
        console.log(`Percentage: ${roundPercentage(this.calcActualPercentage(actualPrice!))}`)

        }
    }
}

const abstractSecurities: AbstractSecurity[] = [
    {
        tick: 'FTEC',
        price: 92.17,
        percentage: 0.4,
    },
    {
        tick: 'HDV',
        price:  92.28,
        percentage: 0.4,
    },
    {
        tick: 'GLDM',
        price: 33.14,
        percentage: 0.2,
    }
]

const securities: Security[] = abstractSecurities.map<Security>((val) => new Security(val))



function calcShares(knownTick: Security, targetTick: Security) {
    return (knownTick.price * knownTick.shares / knownTick.percentage) / (targetTick.price / targetTick.percentage)
}

let minimumPrice: number;
let initialNumberOfTShares = 1

while(!securities.every((sec) => sec.isValid)) {
    const assumedSec = securities[0]
    assumedSec.shares = initialNumberOfTShares++
    for (let index = 1; index < securities.length; index++) {
        const sec = securities[index]
        sec.shares = calcShares(assumedSec, sec)
    }
}

minimumPrice = securities.reduce((acc, sec) => acc + sec.totalPrice, 0)

securities.forEach((sec) => sec.log(minimumPrice))
console.log(`minimumPrice: ${minimumPrice}`)