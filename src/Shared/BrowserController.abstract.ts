import type { Browser, Page } from 'puppeteer'

/** Starts a browser. Production passes a headless puppeteer launch; tests pass a fake. */
export type BrowserLauncher = () => Promise<Browser>

export abstract class BrowserController {
  private browser?: Browser

  /** The launch in progress, shared by concurrent `launchBrowser()` calls. */
  private launching?: Promise<void>

  constructor(private readonly launch: BrowserLauncher) {}

  public async launchBrowser(): Promise<void> {
    if (this.browser) return

    this.launching ??= this.launch().then((browser) => {
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

  /**
   * A new blank page, in a window of its own (ADR-0030). A tab opened beside others is a hidden
   * background tab once a newer one opens, and a hidden page never runs `requestAnimationFrame`,
   * which `waitForSelector(…, { visible: true })` polls with. Alone in its window, every page is
   * the visible, active tab, however many are open at once.
   */
  protected async newPage(): Promise<Page> {
    return this.getBrowser().newPage({ type: 'window' })
  }
}
