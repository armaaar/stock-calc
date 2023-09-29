import { Command } from '@commander-js/extra-typings'
import { showCli } from './CliCommands/show.CliCommand'
import { minimalCli } from './CliCommands/minimal.CliCommand'
import { rebalanceCli } from './CliCommands/rebalance.CliCommand'
import { targetCli } from './CliCommands/target.CliCommand'

const cli = new Command()

cli
  .name('portfolio')
  .description('CLI tool to help you calculate shares in your portfolio')
  .version('0.1.0')

cli.addCommand(showCli)
cli.addCommand(minimalCli)
cli.addCommand(targetCli)
cli.addCommand(rebalanceCli)

cli.parse()
