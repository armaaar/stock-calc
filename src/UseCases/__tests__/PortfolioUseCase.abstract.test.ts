import {
  beforeEach, describe, expect, it, vi,
} from 'vitest'
import { buildPortfolio } from '@/__fixtures__/portfolio'
import { PortfolioRepository } from '@/Repositories/Portfolio.Repository'
import { PortfolioUserCase } from '../PortfolioUseCase.abstract'

const { getPortfolio } = vi.hoisted(() => ({ getPortfolio: vi.fn() }))

vi.mock('@/Repositories/Portfolio.Repository', () => ({
  PortfolioRepository: class {
    getPortfolio = getPortfolio
  },
}))

class ProbeUseCase extends PortfolioUserCase<string> {
  public handler() {
    return this.portfolioType
  }

  public get repo() {
    return this.portfolioRepo
  }

  public load() {
    return this.getSourcePortfolio()
  }
}

describe('PortfolioUserCase', () => {
  beforeEach(() => {
    getPortfolio.mockReset().mockImplementation(async () => buildPortfolio())
  })

  it('stores the portfolio type', () => {
    expect(new ProbeUseCase('EGP').handler()).toBe('EGP')
  })

  it('owns its own repository instance', () => {
    const a = new ProbeUseCase('EUR')
    const b = new ProbeUseCase('EUR')

    expect(a.repo).toBeInstanceOf(PortfolioRepository)
    expect(a.repo).not.toBe(b.repo)
  })

  it('does not load anything until asked', () => {
    new ProbeUseCase('EUR')

    expect(getPortfolio).not.toHaveBeenCalled()
  })

  it('loads the source portfolio from the repository by type', async () => {
    const loaded = buildPortfolio()
    getPortfolio.mockResolvedValueOnce(loaded)

    await expect(new ProbeUseCase('EGP').load()).resolves.toBe(loaded)
    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('EGP')
  })

  it('propagates repository errors', async () => {
    getPortfolio.mockRejectedValueOnce(new Error('no settings'))

    await expect(new ProbeUseCase('NOPE').load()).rejects.toThrow('no settings')
    expect(getPortfolio).toHaveBeenCalledExactlyOnceWith('NOPE')
  })
})
