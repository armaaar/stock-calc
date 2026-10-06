import { Command } from '@commander-js/extra-typings'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { createShowCli } from './CliCommands/show.CliCommand'
import { createMinimalCli } from './CliCommands/minimal.CliCommand'
import { createRebalanceCli } from './CliCommands/rebalance.CliCommand'
import { createTargetCli } from './CliCommands/target.CliCommand'
import { createInvestCli } from './CliCommands/invest.CliCommand'

export function createCli(useCases: PortfolioUseCases) {
  return new Command()
    .name('portfolio')
    .description('CLI tool to help you calculate shares in your portfolio')
    .version('0.1.0')
    .addCommand(createShowCli(useCases.show))
    .addCommand(createMinimalCli(useCases.minimal))
    .addCommand(createTargetCli(useCases.target))
    .addCommand(createRebalanceCli(useCases.rebalance))
    .addCommand(createInvestCli(useCases.invest))
}
