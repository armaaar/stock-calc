import { Browser, launch } from 'puppeteer'

export abstract class BrowserController {
  private browser?: Browser

  /** The launch in progress, shared by concurrent `launchBrowser()` calls. */
  private launching?: Promise<void>

  public async launchBrowser(): Promise<void> {
    if (this.browser) return

    this.launching ??= launch({ headless: true }).then((browser) => {
      this.browser = browser
    })

    try {
      await this.launching
    } finally {
      this.launching = undefined
    }
  }

  public async closeBrowser(): Promise<void> {
    // Let a launch in progress finish, so its browser gets closed too
    await this.launching?.catch(() => undefined)

    try {
      await this.browser?.close()
    } finally {
      this.browser = undefined
    }
  }

  protected getBrowser(): Browser {
    if (!this.browser) {
      throw Error('Can\'t use browser. Please launch the browser first.')
    }
    return this.browser
  }
}
