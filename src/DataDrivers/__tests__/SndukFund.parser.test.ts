import { describe, expect, it } from 'vitest'
import { BMM_FUND, sndukFundPage } from '#src/__fixtures__/snduk'
import { parseSndukFunds } from '../SndukFund.parser'

const BMM = {
  code: 'BMM',
  nameEn: BMM_FUND.nameEn,
  currency: 'EGP',
  currentPrice: '2.4326',
  lastPriceUpdate: '2026-10-06',
}

describe('parseSndukFunds', () => {
  it('reads the fund record the page streams, across chunks and past braces in strings', () => {
    expect(parseSndukFunds(sndukFundPage(BMM_FUND))).toEqual([BMM])
  })

  it('reads every fund record on the page', () => {
    const az30 = {
      ...BMM_FUND, code: 'AZ30', currency: 'USD', currentPrice: 10.1621, lastPriceUpdate: null,
    }

    expect(parseSndukFunds(sndukFundPage(BMM_FUND, az30)).map((fund) => fund.code))
      .toEqual(['BMM', 'AZ30'])
    expect(parseSndukFunds(sndukFundPage(az30))[0])
      .toMatchObject({ currentPrice: 10.1621, lastPriceUpdate: null })
  })

  it('reads a record with escaped quotes in its strings', () => {
    const quoted = { ...BMM_FUND, nameEn: 'Beltone "Meya Meya" \\ EGX100' }

    expect(parseSndukFunds(sndukFundPage(quoted))[0].nameEn).toBe('Beltone "Meya Meya" \\ EGX100')
  })

  it('ignores the key when it is only text in a string', () => {
    const page = sndukFundPage({ note: '"currentPrice":"9"' }, BMM_FUND)

    expect(parseSndukFunds(page)).toEqual([BMM])
  })

  it('gives up on a key after many objects that close before it', () => {
    const chunk = `self.__next_f.push([1,${JSON.stringify(`[${'{},'.repeat(60)}"currentPrice":"1"]`)}])`

    expect(() => parseSndukFunds(`<script>${chunk}</script>`))
      .toThrow('No fund record found in the page')
  })

  it('skips records that are not funds, such as the price label in the translations', () => {
    const noCode = { ...BMM_FUND, code: undefined }

    expect(parseSndukFunds(sndukFundPage(noCode, BMM_FUND))).toEqual([BMM])
  })

  it('keeps a fund without a price, for the caller to reject', () => {
    expect(parseSndukFunds(sndukFundPage({ ...BMM_FUND, currentPrice: null }))[0].currentPrice)
      .toBeNull()
  })

  it('rejects a NAV date that is not a date', () => {
    expect(() => parseSndukFunds(sndukFundPage({ ...BMM_FUND, lastPriceUpdate: 'yesterday' })))
      .toThrow('No fund record found in the page')
  })

  it.each([
    ['a page without streamed data', '<html><body>EGP 2.4326</body></html>'],
    ['a page with only labels', sndukFundPage()],
    ['a sign-in page', '<script>self.__next_f.push([1,"0:{\\"page\\":\\"sign-in\\"}"])</script>'],
  ])('throws for %s', (_, html) => {
    expect(() => parseSndukFunds(html)).toThrow('No fund record found in the page')
  })

  it('ignores a key outside any object, in an object it cannot read, or in one never closed', () => {
    const chunk = (text: string) => `<script>self.__next_f.push([1,${JSON.stringify(text)}])</script>`
    const html = chunk('"currentPrice": {broken')
      + chunk('{"a":{x},"currentPrice":"1"}')
      + chunk('{"currentPrice":"1",')
      + sndukFundPage(BMM_FUND)

    expect(parseSndukFunds(html)).toEqual([BMM])
  })
})
