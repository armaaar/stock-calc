import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { ValidationError } from 'class-validator'
import { ClassValidatorError } from '#src/Shared/ClassValidatorError'

export class ErrorMcpPresenter {
  public static present(error: unknown): CallToolResult {
    return {
      isError: true,
      content: [{ type: 'text', text: ErrorMcpPresenter.format(error).join('\n') }],
    }
  }

  protected static format(error: unknown): string[] {
    if (error instanceof AggregateError) {
      return error.errors.flatMap((e) => ErrorMcpPresenter.format(e))
    }
    if (error instanceof ClassValidatorError) {
      return [
        `${error.name}: ${error.message}`,
        ...error.errors.flatMap((e) => ErrorMcpPresenter.formatClassValidatorError(e)),
      ]
    }
    if (error instanceof Error) {
      return [`${error.name}: ${error.message}`]
    }
    return [String(error)]
  }

  private static formatClassValidatorError(error: ValidationError, depth = 1): string[] {
    const indent = '  '.repeat(depth)
    const owner = error.target ? `${error.target.constructor.name}.` : ''
    const constraints = Object.values(error.constraints ?? {})
      .map((constraint) => `${indent}  - ${constraint}`)
    const children = (error.children ?? [])
      .flatMap((child) => ErrorMcpPresenter.formatClassValidatorError(child, depth + 1))

    return [
      `${indent}${owner}${error.property}:`,
      ...constraints,
      ...children,
    ]
  }
}
