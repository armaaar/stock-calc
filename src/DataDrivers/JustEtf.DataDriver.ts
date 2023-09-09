import puppeteer from 'puppeteer';

interface SecurityPriceDto {
    [key: string]: {
        price: number,
        currency: string
    }
}

export class JustEtf_DataDriver {

    public async getPrices(isin_array: string[]): Promise<SecurityPriceDto> {
        // Launch the browser and open a new blank page
        const browser = await puppeteer.launch({headless: "new"});
        const page = await browser.newPage();
    
        const pricedSecurities: SecurityPriceDto = {}
    
        // Navigate the page to a URL
        for (let i = 0; i < isin_array.length; i++) {
            const isin = isin_array[i];
            
            await page.goto(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`);
        
            // Locate the full title with a unique string
            const priceSelect = await page.waitForSelector('#realtime-quotes .val');
            const fullPrice = await priceSelect?.evaluate(el => el.textContent);
        
        
            const [currency, price] = fullPrice?.split(" ") ?? []
                
            pricedSecurities[isin] = {
                price: Number(price),
                currency,
            }
        }
    
        await browser.close();
    
        return pricedSecurities
    }
}
