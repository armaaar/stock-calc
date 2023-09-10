import puppeteer from 'puppeteer'

interface SecurityPriceDto {
  [key: string]: {
    price: number,
    currency: string
  }
}

export class JustEtfDataDriver {
  public async getPrices(isin_array: string[]): Promise<SecurityPriceDto> {
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({ headless: 'new' })

    const pricedSecurities: SecurityPriceDto = {}

    try {
      await Promise.all(isin_array.map(async (isin) => {
        if (!isin) {
          throw Error('No ISIN provided to get price')
        }
        const page = await browser.newPage()
        await page.goto(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`)

        // Locate the full title with a unique string

        try {
          const priceSelect = await page.waitForSelector('#realtime-quotes .val', { timeout: 1000 })
          const fullPrice = await priceSelect?.evaluate((el) => el.textContent)

          const [currency, price] = fullPrice?.split(' ') ?? []

          pricedSecurities[isin] = {
            price: Number(price),
            currency,
          }
        } catch (e) {
          throw Error(`ISIN '${isin}' is not registered in justetf.com`)
        }
      }))
    } finally {
      await browser.close()
    }

    return pricedSecurities
  }
}
