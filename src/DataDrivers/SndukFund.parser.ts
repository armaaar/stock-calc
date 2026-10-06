import { z } from 'zod'

/**
 * A fund's record as snduk.com embeds it in its fund page: `code` is the fund's own ticker
 * (BMM), `currentPrice` its latest NAV per certificate, and `lastPriceUpdate` the NAV's date.
 */
const SndukFundSchema = z.object({
  code: z.string().trim().min(1),
  nameEn: z.string().optional(),
  currency: z.string().trim().min(1),
  currentPrice: z.union([z.string(), z.number()]).nullable(),
  lastPriceUpdate: z.iso.date().nullable().optional(),
})

export type SndukFund = z.infer<typeof SndukFundSchema>

/** The string chunks Next.js streams the page's data in: `self.__next_f.push([1,"…"])`. */
const FLIGHT_CHUNK = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g

/** The JSON object that `text[from]` (a `{`) opens, by matching braces outside strings. */
function objectAt(text: string, from: number): string | undefined {
  let depth = 0
  let inString = false
  for (let i = from; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (char === '\\') i++
      else if (char === '"') inString = false
    } else if (char === '"') {
      inString = true
    } else if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) return text.slice(from, i + 1)
    }
  }
  return undefined
}

/** How many '{' before a key are tried as the start of the object that holds it. */
const MAX_CANDIDATES = 50

/** The innermost JSON object enclosing `text[index]`, or undefined. */
function objectAround(text: string, index: number): Record<string, unknown> | undefined {
  // The innermost object around the key opens at the closest '{' before it whose match ends after
  // it. A '{' inside a string doesn't open one, so a candidate that isn't JSON is skipped
  let start = text.lastIndexOf('{', index)
  for (let tried = 0; start >= 0 && tried < MAX_CANDIDATES; tried++) {
    const object = objectAt(text, start)
    if (object && start + object.length > index) {
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(object) as Record<string, unknown>
      } catch {
        start = text.lastIndexOf('{', start - 1)
        continue
      }
      // In JSON, a key's quotes can't appear unescaped inside a string, so this object owns it
      return parsed
    }
    start = text.lastIndexOf('{', start - 1)
  }
  return undefined
}

/** Every JSON object in `text` that has a `currentPrice` key of its own. */
function objectsWithPrice(text: string): Record<string, unknown>[] {
  return [...text.matchAll(/"currentPrice":/g)].flatMap((match) => {
    const owner = objectAround(text, match.index)
    return owner ? [owner] : []
  })
}

/**
 * The fund records a snduk.com fund page embeds. The page renders on the server, so they are in
 * its HTML, in the data Next.js streams with it. Throws when there are none.
 */
export function parseSndukFunds(html: string): SndukFund[] {
  const flight = [...html.matchAll(FLIGHT_CHUNK)]
    .map(([, chunk]) => JSON.parse(chunk) as string)
    .join('')

  const funds = objectsWithPrice(flight).flatMap((record) => {
    const fund = SndukFundSchema.safeParse(record)
    return fund.success ? [fund.data] : []
  })
  if (funds.length === 0) throw Error('No fund record found in the page')
  return funds
}
