import { composePortfolioUseCases } from '#src/compositionRoot'
import { createCli } from './cli'

await createCli(composePortfolioUseCases()).parseAsync()
