import fs from 'fs'
import path from 'path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Architecture test for ADR-0004. `validateClassErrors(this, Cls)` only validates when
 * `this.constructor === Cls`, so every class with class-validator decorators, and every subclass
 * of one, must make that call itself, naming itself. Otherwise it is silently never validated.
 * The sources are read with the TypeScript parser, so line breaks, generics, default exports and
 * renamed imports don't hide a class.
 */

type SourceFile = { file: string, source: string }

type ClassInfo = {
  name: string
  base?: string
  isAbstract: boolean
  decorated: boolean
  callsValidation: boolean
  file: string
}

/** The local names a file gives class-validator's decorators, and its namespace imports. */
function validatorImports(sourceFile: ts.SourceFile) {
  const names = new Set<string>()
  const namespaces = new Set<string>()
  sourceFile.statements.forEach((statement) => {
    if (!ts.isImportDeclaration(statement)) return
    if ((statement.moduleSpecifier as ts.StringLiteral).text !== 'class-validator') return
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamespaceImport(bindings)) namespaces.add(bindings.name.text)
    if (bindings && ts.isNamedImports(bindings)) {
      bindings.elements.forEach((element) => names.add(element.name.text))
    }
  })
  return { names, namespaces }
}

function classesOf({ file, source }: SourceFile): ClassInfo[] {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const { names, namespaces } = validatorImports(sourceFile)

  const isValidatorDecorator = (decorator: ts.Decorator) => {
    const callee = ts.isCallExpression(decorator.expression)
      ? decorator.expression.expression
      : decorator.expression
    if (ts.isIdentifier(callee)) return names.has(callee.text)
    return ts.isPropertyAccessExpression(callee)
      && ts.isIdentifier(callee.expression)
      && namespaces.has(callee.expression.text)
  }

  const classes: ClassInfo[] = []
  const visit = (node: ts.Node) => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      const name = node.name?.text ?? 'default'
      const extendsClause = node.heritageClauses
        ?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
      const baseExpression = extendsClause?.types[0]?.expression
      const calls: string[] = []
      const findCalls = (inner: ts.Node) => {
        if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression)
          && inner.expression.text === 'validateClassErrors'
          && inner.arguments[0]?.kind === ts.SyntaxKind.ThisKeyword
          && inner.arguments[1] && ts.isIdentifier(inner.arguments[1])) {
          calls.push(inner.arguments[1].text)
        }
        ts.forEachChild(inner, findCalls)
      }
      node.members.filter(ts.isConstructorDeclaration).forEach(findCalls)

      classes.push({
        name,
        base: baseExpression && ts.isIdentifier(baseExpression) ? baseExpression.text : undefined,
        isAbstract: ts.getModifiers(node)
          ?.some((modifier) => modifier.kind === ts.SyntaxKind.AbstractKeyword) ?? false,
        decorated: node.members.some((member) => (
          ts.canHaveDecorators(member)
          && (ts.getDecorators(member) ?? []).some(isValidatorDecorator)
        )),
        callsValidation: calls.includes(name),
        file,
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return classes
}

/** The concrete classes that must call `validateClassErrors(this, <themselves>)` but don't. */
export function classesMissingValidation(files: SourceFile[]): string[] {
  const classes = files.flatMap(classesOf)

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
    .filter((cls) => validated.has(cls.name) && !cls.isAbstract && !cls.callsValidation)
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
    const decorated = sources.flatMap(classesOf).filter((cls) => cls.decorated)

    // Sanity check that the scan sees the validated classes at all
    expect(decorated.map((cls) => cls.name)).toEqual(expect.arrayContaining([
      'Portfolio', 'PortfolioSecurity', 'Security', 'PriceQuote', 'Investment',
    ]))
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

  it('flags a subclass that validates under its base class name', () => {
    const source = `import { Min } from 'class-validator'
export class Base {
  @Min(0)
  public value = 1
  constructor() {
    validateClassErrors(this, Base)
  }
}
export class Child extends Base {
  constructor() {
    super()
    validateClassErrors(this, Base)
  }
}`

    expect(classesMissingValidation([{ file: 'Base.ts', source }])).toEqual(['Child (Base.ts)'])
  })

  it('follows subclasses across files, line breaks and generics', () => {
    const base = `import { Min } from 'class-validator'
export class Base<T> {
  @Min(0)
  public value = 1
  constructor() {
    validateClassErrors(this, Base)
  }
}`
    const child = `export class Child<T extends Map<string, number>>
  extends Base<T> {}
export default class extends Child<Map<string, number>> {}
export class GrandChild extends Child<Map<string, number>> {}`

    expect(classesMissingValidation([
      { file: 'Base.ts', source: base },
      { file: 'Child.ts', source: child },
    ])).toEqual(['Child (Child.ts)', 'default (Child.ts)', 'GrandChild (Child.ts)'])
  })

  it('sees decorators imported under another name or through a namespace', () => {
    const source = `import { Min as AtLeast } from 'class-validator'
import * as validator from 'class-validator'
export class Renamed {
  @AtLeast(0)
  public value = 1
}
export class Namespaced {
  @validator.IsInt()
  public value = 1
}`

    expect(classesMissingValidation([{ file: 'Mixed.ts', source }]))
      .toEqual(['Renamed (Mixed.ts)', 'Namespaced (Mixed.ts)'])
  })

  it('ignores abstract classes, classes without validation, and other decorators', () => {
    const source = `import { Min } from 'class-validator'
import { Injectable } from 'elsewhere'
export abstract class Shape {
  @Min(0)
  public size = 1
}
export class Plain {
  public value = 1
}
export class Service {
  @Injectable()
  public value = 1
}`

    expect(classesMissingValidation([{ file: 'Shape.ts', source }])).toEqual([])
  })
})
