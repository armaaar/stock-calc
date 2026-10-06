// Node module hooks resolving the `@/` alias (tsconfig `paths`) to `src/`.
// tsx applies tsconfig paths only outside node_modules, so a copy installed by npx needs this.
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const src = path.resolve(import.meta.dirname, '../src')

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const file = path.join(src, `${specifier.slice(2)}.ts`)
    return nextResolve(pathToFileURL(file).href, context)
  }
  return nextResolve(specifier, context)
}
