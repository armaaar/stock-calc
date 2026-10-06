import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

/**
 * Architecture test for ADR-0004. `validateClassErrors(this, Cls)` only validates when
 * `this.constructor === Cls`, so every class with class-validator decorators, and every subclass
 * of one, must make that call itself, naming itself. Otherwise it is silently never validated.
 */

type SourceFile = { file: string, source: string }

type ClassInfo = { name: string, base?: string, isAbstract: boolean, body: string, file: string }

const CLASS_DECLARATION = /^(?:export )?(abstract )?class (\w+)(?:<[^>]*>)?(?: extends (\w+))?/gm

function classesOf({ file, source }: SourceFile): ClassInfo[] {
  const matches = [...source.matchAll(CLASS_DECLARATION)]
  return matches.map((match, i) => ({
    name: match[2],
    base: match[3],
    isAbstract: match[1] !== undefined,
    // Up to the next class in the file: enough to find decorators and the constructor's call
    body: source.slice(match.index, matches[i + 1]?.index ?? source.length),
    file,
  }))
}

/** The decorators a file imports from class-validator. */
function validatorDecorators(source: string): string[] {
  const imports = source.match(/import\s*\{([^}]*)\}\s*from\s*'class-validator'/)
  return imports ? imports[1].split(',').map((name) => name.trim()).filter(Boolean) : []
}

/** The concrete classes that must call `validateClassErrors(this, <themselves>)` but don't. */
export function classesMissingValidation(files: SourceFile[]): string[] {
  const classes = files.flatMap((file) => {
    const decorators = validatorDecorators(file.source)
    return classesOf(file).map((cls) => ({
      ...cls,
      decorated: decorators.some((decorator) => cls.body.includes(`@${decorator}(`)),
    }))
  })

  // A class is validated if it has decorators or extends a validated class
  const validated = new Set(classes.filter((cls) => cls.decorated).map((cls) => cls.name))
  let grew = true
  while (grew) {
    grew = false
    classes.forEach((cls) => {
      if (cls.base && validated.has(cls.base) && !validated.has(cls.name)) {
        validated.add(cls.name)
        grew = true
      }
    })
  }

  return classes
    .filter((cls) => validated.has(cls.name) && !cls.isAbstract)
    .filter((cls) => !cls.body.includes(`validateClassErrors(this, ${cls.name})`))
    .map((cls) => `${cls.name} (${cls.file})`)
}

function productionSources(dir: string): SourceFile[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return ['__tests__', '__fixtures__', 'data'].includes(entry.name) ? [] : productionSources(full)
    }
    return entry.name.endsWith('.ts') ? [{ file: full, source: fs.readFileSync(full, 'utf8') }] : []
  })
}

describe('class validation (ADR-0004)', () => {
  it('every validated class in src calls validateClassErrors on itself', () => {
    const sources = productionSources(path.resolve(import.meta.dirname, '..'))

    // Sanity check that the scan sees the validated classes at all
    expect(sources.map((s) => path.basename(s.file))).toContain('PortfolioSecurity.Entity.ts')
    expect(classesMissingValidation(sources)).toEqual([])
  })

  it('flags a decorated class that never validates itself', () => {
    const source = `import { Min } from 'class-validator'
export class Amount {
  @Min(0)
  public value = 1
}`

    expect(classesMissingValidation([{ file: 'Amount.ts', source }])).toEqual(['Amount (Amount.ts)'])
  })

  it('flags a subclass that relies on its base class to validate, in another file', () => {
    const base = `import { Min } from 'class-validator'
export class Base {
  @Min(0)
  public value = 1
  constructor() {
    validateClassErrors(this, Base)
  }
}`
    const child = `export class Child extends Base {
  constructor() {
    super()
    validateClassErrors(this, Base)
  }
}
export class GrandChild extends Child {}`

    expect(classesMissingValidation([
      { file: 'Base.ts', source: base },
      { file: 'Child.ts', source: child },
    ])).toEqual(['Child (Child.ts)', 'GrandChild (Child.ts)'])
  })

  it('ignores abstract classes and classes without validation', () => {
    const source = `import { Min } from 'class-validator'
export abstract class Shape {
  @Min(0)
  public size = 1
}
export class Plain {
  public value = 1
}`

    expect(classesMissingValidation([{ file: 'Shape.ts', source }])).toEqual([])
  })
})
