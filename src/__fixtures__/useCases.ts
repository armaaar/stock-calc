import { vi } from 'vitest'
import type { Portfolio } from '#src/Entities/Portfolio.Entity'
import type { PortfolioUseCases } from '#src/UseCases/PortfolioUseCases.factory'

type Stub<K extends keyof PortfolioUseCases> = {
  execute: ReturnType<typeof vi.fn<(request: Parameters<PortfolioUseCases[K]['execute']>[0]) => Promise<Portfolio>>>
}

/** Use-case stubs for interface tests: `execute` is a `vi.fn()` per operation. */
export function stubUseCases(): { [K in keyof PortfolioUseCases]: Stub<K> } {
  return {
    show: { execute: vi.fn() },
    minimal: { execute: vi.fn() },
    target: { execute: vi.fn() },
    rebalance: { execute: vi.fn() },
    invest: { execute: vi.fn() },
  }
}

export type StubUseCases = ReturnType<typeof stubUseCases>
