import { vi } from 'vitest'
import type { Portfolio } from '#src/Entities/Portfolio.Entity'
import type { IPortfolioRepository } from '#src/UseCases/IPortfolioRepository.type'
import { createPortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'
import { buildPortfolio } from './portfolio'

/** An in-memory `IPortfolioRepository`: every load returns a fresh `buildPortfolio()`. */
export function fakePortfolioRepository(
  load: (type: string) => Promise<Portfolio> = async () => buildPortfolio(),
) {
  return { getPortfolio: vi.fn<IPortfolioRepository['getPortfolio']>(load) }
}

export type FakePortfolioRepository = ReturnType<typeof fakePortfolioRepository>

/** The real use cases over a fake repository: the domain runs, nothing is read or scraped. */
export function useCasesOver(repo: IPortfolioRepository = fakePortfolioRepository()) {
  return createPortfolioUseCases(repo)
}
