import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { createFakeBrowser, FakeBrowser } from '@/__fixtures__/puppeteer'
import { BrowserController } from '.././BrowserController.abstract'

const puppeteer = vi.hoisted(() => ({ launch: vi.fn() }))

vi.mock('puppeteer', () => ({ launch: puppeteer.launch }))

class TestController extends BrowserController {
  public currentBrowser(): FakeBrowser {
    return this.getBrowser() as unknown as FakeBrowser
  }
}

describe('BrowserController', () => {
  let controller: TestController

  beforeEach(() => {
    puppeteer.launch.mockReset()
    puppeteer.launch.mockImplementation(async () => createFakeBrowser())
    controller = new TestController()
  })

  it('getBrowser throws before the browser is launched', () => {
    expect(() => controller.currentBrowser())
      .toThrow('Can\'t use browser. Please launch the browser first.')
  })

  it('launches a headless browser and exposes it through getBrowser', async () => {
    await controller.launchBrowser()

    expect(puppeteer.launch).toHaveBeenCalledOnce()
    expect(puppeteer.launch).toHaveBeenCalledWith({ headless: true })
    expect(controller.currentBrowser()).toBe(await puppeteer.launch.mock.results[0].value)
  })

  it('launches only once when already launched', async () => {
    await controller.launchBrowser()
    const browser = controller.currentBrowser()

    await controller.launchBrowser()

    expect(puppeteer.launch).toHaveBeenCalledOnce()
    expect(controller.currentBrowser()).toBe(browser)
  })

  it('closes the browser and resets, so getBrowser throws and the next launch is fresh', async () => {
    await controller.launchBrowser()
    const browser = controller.currentBrowser()

    await controller.closeBrowser()

    expect(browser.close).toHaveBeenCalledOnce()
    expect(() => controller.currentBrowser()).toThrow(/launch the browser first/)

    await controller.launchBrowser()

    expect(puppeteer.launch).toHaveBeenCalledTimes(2)
    expect(controller.currentBrowser()).not.toBe(browser)
  })

  it('closing a browser that was never launched is a no-op', async () => {
    await expect(controller.closeBrowser()).resolves.toBeUndefined()
    expect(puppeteer.launch).not.toHaveBeenCalled()
  })

  it('each controller owns its own browser', async () => {
    const other = new TestController()

    await controller.launchBrowser()
    await other.launchBrowser()

    expect(puppeteer.launch).toHaveBeenCalledTimes(2)
    expect(controller.currentBrowser()).not.toBe(other.currentBrowser())
  })

  // Current behaviour: concurrent launches aren't de-duplicated, because `this.browser` is only
  // set after `launch` resolves. The first browser is leaked (never closed).
  it('launches twice when launchBrowser is called concurrently', async () => {
    await Promise.all([controller.launchBrowser(), controller.launchBrowser()])

    expect(puppeteer.launch).toHaveBeenCalledTimes(2)
  })

  // Current behaviour: if close() rejects, the error propagates and the reference is NOT reset.
  it('keeps the browser reference when close() rejects', async () => {
    await controller.launchBrowser()
    const browser = controller.currentBrowser()
    browser.close.mockRejectedValueOnce(Error('close failed'))

    await expect(controller.closeBrowser()).rejects.toThrow('close failed')
    expect(controller.currentBrowser()).toBe(browser)
  })
})
