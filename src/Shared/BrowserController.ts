import { launch, Browser } from 'puppeteer'

const browserControllerFinalizationRegistry = new FinalizationRegistry(
  async (browser: Promise<Browser>) => {
    await (await browser).close()
  },
)

export abstract class BrowserController {
  protected browser: Promise<Browser>

  constructor() {
    this.browser = launch({ headless: 'new' })
    browserControllerFinalizationRegistry.register(this, this.browser)
  }
}
