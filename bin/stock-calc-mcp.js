#!/usr/bin/env node
// Entry point for `npx github:armaaar/stock-calc`: runs the TypeScript MCP server through tsx.
// The tsconfig is passed explicitly because npx starts the process in the user's folder, where
// tsx would otherwise look for it (it provides the decorator settings). `#src/*` imports are
// resolved by Node itself, from the `imports` field of package.json.
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { register } from 'tsx/esm/api'

const root = path.resolve(import.meta.dirname, '..')

register({ tsconfig: path.join(root, 'tsconfig.json') })

await import(pathToFileURL(path.join(root, 'src/McpApp/app.ts')).href)
