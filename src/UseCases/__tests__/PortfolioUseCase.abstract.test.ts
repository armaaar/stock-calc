import {
  beforeEach, describe, expect, it,
} from 'vitest'
import { buildPortfolio } from '#src/__fixtures__/portfolio'
import { FakePortfolioRepository, fakePortfolioRepository } from '#src/__fixtures__/repository'
import { PortfolioRequest, PortfolioUseCase } from '../PortfolioUseCase.abstract'

/** The smallest concrete use case: loads the requested portfolio and exposes the repository. */
class ProbeUseCase extends PortfolioUseCase {
  public async execute({ portfolio }: PortfolioRequest) {
    return this.portfolioRepo.getPortfolio(portfolio)
  }

  public get repo() {
    return this.portfolioRepo
  }
}

describe('PortfolioUseCase', () => {
  let repo: FakePortfolioRepository

  beforeEach(() => {
    repo = fakePortfolioRepository()
  })

  it('holds the injected repository', () => {
    expect(new ProbeUseCase(repo).repo).toBe(repo)
  })

  it('shares one repository between use cases built over it', () => {
    const a = new ProbeUseCase(repo)
    const b = new ProbeUseCase(repo)

    expect(a.repo).toBe(b.repo)
  })

  it('does not load anything on construction', () => {
    new ProbeUseCase(repo)

    expect(repo.getPortfolio).not.toHaveBeenCalled()
  })

  it('loads through the injected repository by type when executed', async () => {
    const loaded = buildPortfolio()
    repo.getPortfolio.mockResolvedValueOnce(loaded)

    await expect(new ProbeUseCase(repo).execute({ portfolio: 'thndr/egp' })).resolves.toBe(loaded)
    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('thndr/egp')
  })

  it('propagates repository errors', async () => {
    repo.getPortfolio.mockRejectedValueOnce(new Error('no settings'))

    await expect(new ProbeUseCase(repo).execute({ portfolio: 'NOPE' }))
      .rejects.toThrow('no settings')
    expect(repo.getPortfolio).toHaveBeenCalledExactlyOnceWith('NOPE')
  })
})
