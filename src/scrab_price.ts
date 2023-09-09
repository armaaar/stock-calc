import puppeteer from 'puppeteer';
import { AbstractSecurity, PricedAbstractSecurity } from './securities';

export async function scrap_prices(securities: AbstractSecurity[]): Promise<PricedAbstractSecurity[]> {
    // Launch the browser and open a new blank page
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();

    const pricedSecurities: PricedAbstractSecurity[] = []

    // Navigate the page to a URL
    for (let i = 0; i < securities.length; i++) {
        const {isin} = securities[i];
        
        await page.goto(`https://www.justetf.com/en/etf-profile.html?isin=${isin}`);
    
        // Locate the full title with a unique string
        const priceSelect = await page.waitForSelector('#realtime-quotes .val');
        const fullPrice = await priceSelect?.evaluate(el => el.textContent);
    
    
        const [currency, price] = fullPrice?.split(" ") ?? []
            
        pricedSecurities.push({
            ...securities[i],
            price: Number(price),
            currency,
        })
    }

    await browser.close();

    return pricedSecurities
}