import { Command } from '@commander-js/extra-typings'
import { getPortfolioCli } from './CliCommands/getPortfolio.CliCommand'
import { minimumSharesCli } from './CliCommands/minimumShares.CliCommand'
import { rebalancePortfolioCli } from './CliCommands/rebalancePortfolio.CliCommand'
import { targetPriceCli } from './CliCommands/targetPrice.CliCommand'

const cli = new Command()

cli
  .name('portfolio-helper')
  .description('CLI tool to help you calculate shares in your portfolio')
  .version('0.1.0')

cli.addCommand(getPortfolioCli)
cli.addCommand(minimumSharesCli)
cli.addCommand(targetPriceCli)
cli.addCommand(rebalancePortfolioCli)

cli.parse()
