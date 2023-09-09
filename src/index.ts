import 'dotenv/config'
import { abstractSecurities } from './portfolio'
import { scrap_prices } from './scrab_price'
import { Security } from './securities'

(async() => {
    
    const securities: Security[] = (await scrap_prices(abstractSecurities)).map<Security>((val) => new Security(val))

    function calcShares(knownTick: Security, targetTick: Security) {
        return (knownTick.price * knownTick.shares / knownTick.targetPercentage) / (targetTick.price / targetTick.targetPercentage)
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
})()