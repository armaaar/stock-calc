/** BMM's record as snduk.com's fund page embeds it (trimmed). */
export const BMM_FUND = {
  id: 2,
  nameEn: 'Beltone Meya Meya (100/100) EGX100 Index Equity Fund',
  name: 'صندوق بلتون مية مية (100/100) للاستثمار في أسهم مؤشر EGX100',
  currency: 'EGP',
  code: 'BMM',
  metrics: { cagr: 56.6, note: 'braces { in } strings' },
  currentPrice: '2.4326',
  priceChange: null,
  lastPriceUpdate: '2026-10-06',
  country: 'EG',
  isActive: true,
}

/**
 * A snduk.com fund page as it arrives: HTML whose data Next.js streams in
 * `self.__next_f.push([1,"…"])` chunks. The fund records sit inside React element rows, next to
 * the page's translations, which also have a `currentPrice` key (a label).
 */
export function sndukFundPage(...funds: object[]): string {
  const rows = [
    '0:{"P":null,"b":"build","c":["","eg","funds","beltone-meya-100"]}',
    `1:{"lang":"en","fund":{"currentPrice":"Current Price","lastUpdated":"Last Updated"}}`,
    ...funds.map((fund, i) => (
      `2${i}:["$","div",null,{"className":"text-2xl","children":["$L25",{"fund":${JSON.stringify(fund)}}]}]`
    )),
  ]
  // Next.js splits the stream into chunks anywhere, even inside a record
  const flight = rows.join('\n')
  const half = Math.floor(flight.length / 2)
  const chunks = [flight.slice(0, half), flight.slice(half)]
  return '<!DOCTYPE html><html><body><div class="text-2xl font-bold">EGP 2.4326</div>'
    + chunks.map((chunk) => `<script>self.__next_f.push([1,${JSON.stringify(chunk)}])</script>`)
      .join('')
      + '</body></html>'
}
