import { Command } from 'commander';
import { minimumSharesCli } from './CliCommands/minimumShares.CliCommand';
import { targetPriceCli } from './CliCommands/targetPrice.CliCommand';

const cli = new Command();

cli
    .name('portfolio-helper')
    .description('CLI tool to help you calculate shares in your portfolio')
    .version('0.1.0');

cli.addCommand(minimumSharesCli)
cli.addCommand(targetPriceCli)

cli.parse();