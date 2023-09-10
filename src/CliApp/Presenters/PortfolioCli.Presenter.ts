import { Portfolio } from "@/Entities/Portfolio.Entity"
import { roundPercentage } from "@/Shared/utils"

export class PortfolioCli_Presenter
{
    public static present(portfolio: Portfolio): void {
        portfolio.securities.forEach((sec) => {
            console.log(`------------------------ ${sec.tick}${sec.exchange ? ` @ ${sec.exchange}` : ''} ------------------------`)
            console.log(`Price: ${sec.price} ${sec.currency ?? ''}`)
            console.log(`Shares: ${sec.shares}`)
            console.log(`Total Price: ${sec.totalPrice} ${sec.currency ?? ''}`)
            if (![undefined, NaN, 0].includes(portfolio.totalPrice)) {
                console.log(`Percentage: ${roundPercentage(sec.calcActualPercentage(portfolio.totalPrice))}%`)
            }
            console.log(`Target Percentage: ${roundPercentage(sec.targetPercentage)}%`)
        })

        console.log("")
        console.log(`Portfolio Price: ${portfolio.totalPrice} ${portfolio.currency ?? ''}`)
    }
}