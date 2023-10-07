import { Browser, launch } from 'puppeteer'

export abstract class BrowserController {
  private browser?: Browser

  public async launchBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await launch({ headless: 'new' })
    }
  }

  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
    }
    this.browser = undefined
  }

  protected getBrowser(): Browser {
    if (!this.browser) {
      throw Error('Can\'t use browser. Please launch the browser first.')
    }
    return this.browser
  }
}
