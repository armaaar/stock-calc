import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { createFakeBrowser, FakeBrowser, fakeLauncher } from '#src/__fixtures__/puppeteer'
import { BrowserController } from '../BrowserController.abstract'

class TestController extends BrowserController {
  public currentBrowser(): FakeBrowser {
    return this.getBrowser() as unknown as FakeBrowser
  }

  public async openPage() {
    return this.newPage()
  }
}

describe('BrowserController', () => {
  let first: FakeBrowser
  let second: FakeBrowser
  let launch: ReturnType<typeof fakeLauncher>
  let controller: TestController

  beforeEach(() => {
    first = createFakeBrowser()
    second = createFakeBrowser()
    launch = fakeLauncher(first, second)
    controller = new TestController(launch)
  })

  it('getBrowser throws before the browser is launched', () => {
    expect(() => controller.currentBrowser())
      .toThrow('Can\'t use browser. Please launch the browser first.')
  })

  describe('newPage', () => {
    it('opens a blank page in a window of its own, so it is never a hidden background tab', async () => {
      await controller.launchBrowser()

      await expect(controller.openPage()).resolves.toBe(first.page)

      expect(first.newPage).toHaveBeenCalledExactlyOnceWith({ type: 'window' })
    })

    it('rejects before the browser is launched', async () => {
      await expect(controller.openPage()).rejects.toThrow(/launch the browser first/)
    })
  })

  it('does not launch anything when constructed', () => {
    expect(launch).not.toHaveBeenCalled()
  })

  it('launches through the injected launcher and exposes its browser through getBrowser', async () => {
    await controller.launchBrowser()

    expect(launch).toHaveBeenCalledOnce()
    expect(launch).toHaveBeenCalledWith()
    expect(controller.currentBrowser()).toBe(first)
  })

  it('launches only once when already launched', async () => {
    await controller.launchBrowser()

    await controller.launchBrowser()

    expect(launch).toHaveBeenCalledOnce()
    expect(controller.currentBrowser()).toBe(first)
  })

  it('closes the browser and resets, so getBrowser throws and the next launch is fresh', async () => {
    await controller.launchBrowser()

    await controller.closeBrowser()

    expect(first.close).toHaveBeenCalledOnce()
    expect(() => controller.currentBrowser()).toThrow(/launch the browser first/)

    await controller.launchBrowser()

    expect(launch).toHaveBeenCalledTimes(2)
    expect(controller.currentBrowser()).toBe(second)
  })

  it('closing a browser that was never launched is a no-op', async () => {
    await expect(controller.closeBrowser()).resolves.toBeUndefined()
    expect(launch).not.toHaveBeenCalled()
  })

  it('each controller owns its own browser and launcher', async () => {
    const otherBrowser = createFakeBrowser()
    const otherLaunch = fakeLauncher(otherBrowser)
    const other = new TestController(otherLaunch)

    await controller.launchBrowser()
    await other.launchBrowser()

    expect(launch).toHaveBeenCalledOnce()
    expect(otherLaunch).toHaveBeenCalledOnce()
    expect(controller.currentBrowser()).toBe(first)
    expect(other.currentBrowser()).toBe(otherBrowser)
  })

  describe('concurrent launches', () => {
    it('share one in-flight launch, so only one browser is started', async () => {
      await Promise.all([controller.launchBrowser(), controller.launchBrowser()])

      expect(launch).toHaveBeenCalledOnce()
      expect(controller.currentBrowser()).toBe(first)
    })

    it('all reject when the shared launch fails, and a later launch retries', async () => {
      launch.mockRejectedValueOnce(Error('launch failed'))

      const results = await Promise.allSettled([
        controller.launchBrowser(),
        controller.launchBrowser(),
      ])

      expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected'])
      expect(launch).toHaveBeenCalledOnce()
      expect(() => controller.currentBrowser()).toThrow(/launch the browser first/)

      await controller.launchBrowser()

      expect(launch).toHaveBeenCalledTimes(2)
      expect(controller.currentBrowser()).toBe(first)
    })

    it('closeBrowser waits for a launch in progress and closes that browser', async () => {
      const launching = controller.launchBrowser()

      await controller.closeBrowser()
      await launching

      expect(launch).toHaveBeenCalledOnce()
      expect(first.close).toHaveBeenCalledOnce()
      expect(() => controller.currentBrowser()).toThrow(/launch the browser first/)
    })

    it('closeBrowser ignores a launch in progress that fails', async () => {
      launch.mockRejectedValueOnce(Error('launch failed'))
      const launching = controller.launchBrowser()

      await expect(controller.closeBrowser()).resolves.toBeUndefined()
      await expect(launching).rejects.toThrow('launch failed')
    })
  })

  it('resets the browser reference and propagates the error when close() rejects', async () => {
    await controller.launchBrowser()
    first.close.mockRejectedValueOnce(Error('close failed'))

    await expect(controller.closeBrowser()).rejects.toThrow('close failed')
    expect(() => controller.currentBrowser()).toThrow(/launch the browser first/)

    await controller.launchBrowser()

    expect(launch).toHaveBeenCalledTimes(2)
    expect(controller.currentBrowser()).toBe(second)
  })
})
