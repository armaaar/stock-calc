#!/usr/bin/env node
// Entry point for `npx github:armaaar/stock-calc`: runs the TypeScript MCP server through tsx.
// The tsconfig is passed explicitly because npx starts the process in the user's folder, where
// tsx would otherwise look for it (it provides the decorator settings). The `@/` alias is
// resolved by alias-hooks.js, registered last so it runs before tsx's resolver.
import { register as registerHooks } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { register } from 'tsx/esm/api'

const root = path.resolve(import.meta.dirname, '..')

register({ tsconfig: path.join(root, 'tsconfig.json') })
registerHooks('./alias-hooks.js', import.meta.url)

await import(pathToFileURL(path.join(root, 'src/McpApp/app.ts')).href)
