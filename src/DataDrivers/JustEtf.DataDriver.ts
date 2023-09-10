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

    const promises = isin_array.map(async (isin) => {
      const page = await browser.newPage()
      await page.goto(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`)

      // Locate the full title with a unique string
      const priceSelect = await page.waitForSelector('#realtime-quotes .val')
      const fullPrice = await priceSelect?.evaluate((el) => el.textContent)

      const [currency, price] = fullPrice?.split(' ') ?? []

      pricedSecurities[isin] = {
        price: Number(price),
        currency,
      }
    })

    await Promise.all(promises)

    await browser.close()

    return pricedSecurities
  }
}
