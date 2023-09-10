/* eslint-disable no-console */
import chalk from 'chalk'
import { ValidationError } from 'class-validator'
import { ClassValidatorError } from '@/Shared/ClassValidatorError'

export class ErrorCliPresenter {
  public static present(error: unknown): void {
    if (error instanceof ClassValidatorError) {
      console.error(chalk.red(`${error.name}: ${error.message}`))
      error.errors.forEach((e) => this.presentClassValidatorError(e), this)
    } else if (error instanceof Error) {
      console.error(chalk.red(`${error.name}: ${error.message}`))
    } else {
      console.error(String(error))
    }
  }

  private static presentClassValidatorError(error: ValidationError, depth: number = 1) {
    console.error(chalk.red(`${'-'.repeat(depth)} Errors For '${chalk.yellow(error.target?.constructor.name)}' => '${chalk.yellow(error.property)}'`))
    if (error.constraints) {
      console.table(error.constraints)
    }
    if (error.children && error.children.length > 0) {
      error.children.forEach((child) => this.presentClassValidatorError(child, depth + 1), this)
    }
  }
}
