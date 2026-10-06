import { SecurityPriceDto } from './IPriceDataDriver.type'

/** Scraped text: `null` / `undefined` when the element or its text is missing. */
type ScrapedText = string | null | undefined

/**
 * Turns scraped price and currency texts into a validated quote. Whitespace (including
 * no-break spaces) and thousands commas are stripped from the price, which must then be a
 * finite number > 0. The currency must not be empty. Throws a descriptive Error otherwise.
 */
export function parsePriceQuote(
  priceText: ScrapedText,
  currencyText: ScrapedText,
): SecurityPriceDto {
  // `\s` also matches U+00A0 (no-break space) and U+202F (narrow no-break space)
  const digits = (priceText ?? '').replace(/[\s,]/g, '')
  if (digits === '') {
    throw Error('No price text found')
  }

  const price = Number(digits)
  if (!/^\d+(\.\d+)?$/.test(digits) || !Number.isFinite(price) || price <= 0) {
    throw Error(`Price '${priceText}' is not a positive number`)
  }

  const currency = (currencyText ?? '').trim()
  if (currency === '') {
    throw Error('No currency text found')
  }

  return { price, currency }
}
