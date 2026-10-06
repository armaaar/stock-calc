import { launch } from 'puppeteer'
import { dataDirectory } from '#src/DataDrivers/DataFiles.reader'
import { JustEtfDataDriver } from '#src/DataDrivers/JustEtf.DataDriver'
import { OverridesDataDriver } from '#src/DataDrivers/Overrides.DataDriver'
import { SettingsDataDriver } from '#src/DataDrivers/Settings.DataDriver'
import { SndukDataDriver } from '#src/DataDrivers/Snduk.DataDriver'
import { TradingViewDataDriver } from '#src/DataDrivers/TradingView.DataDriver'
import { PortfolioRepository } from '#src/Repositories/Portfolio.Repository'
import { createPortfolioUseCases, PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'

/**
 * The composition root: the one place that picks the real adapters. Both entry points
 * (`CliApp/app.ts`, `McpApp/app.ts`) call it; everything else receives its dependencies.
 *
 * @param dataDir the folder holding the portfolio files; `$STOCK_CALC_DATA_DIR` or `src/data`
 */
export function composePortfolioUseCases(dataDir: string = dataDirectory()): PortfolioUseCases {
  const launchBrowser = () => launch({ headless: true })

  // TradingView prices securities and exchange rates, in one browser
  const tradingView = new TradingViewDataDriver(launchBrowser)
  const portfolioRepo = new PortfolioRepository({
    settings: new SettingsDataDriver(dataDir),
    overrides: new OverridesDataDriver(dataDir),
    // Each security is asked only the sources that can price it: a fund only snduk.com
    prices: [new SndukDataDriver(fetch), new JustEtfDataDriver(launchBrowser), tradingView],
    rates: [tradingView],
  })

  return createPortfolioUseCases(portfolioRepo)
}
