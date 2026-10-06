# Architecture Decision Records

An ADR records one significant architectural decision: its context, the decision, and its consequences. We use the lightweight [Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

ADR-0002 through ADR-0011 were **recorded retroactively** on 2026-10-06. ADR-0012 and later were written when the decision was made. Each one is dated by the commit that introduced the decision. Where the commit history doesn't state the rationale, the context section reconstructs it from the code.

## Index

| # | Title | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | 2026-10-06 |
| [0002](0002-layered-clean-architecture.md) | Layered clean architecture | Accepted | 2023-09-09 |
| [0003](0003-decimal-arithmetic.md) | Use arbitrary-precision decimals for money and percentages | Accepted | 2023-09-10 |
| [0004](0004-self-validating-entities.md) | Self-validating entities with class-validator | Accepted | 2023-09-10 |
| [0005](0005-scrape-prices-with-headless-browser.md) | Scrape live prices with a headless browser | Accepted | 2023-09-09 |
| [0006](0006-race-multiple-price-sources.md) | Race multiple price sources, one browser per source per run | Accepted | 2023-10-07 |
| [0007](0007-local-jsonc-portfolio-files.md) | Local JSONC portfolio files validated with typia | Accepted (validation superseded by 0012) | 2023-10-07 |
| [0008](0008-manual-price-overrides.md) | Manual price overrides per portfolio | Accepted | 2024-07-21 |
| [0009](0009-run-typescript-directly-with-ts-node.md) | Run TypeScript directly with ts-node (no build step) | Superseded by 0013 | 2023-10-07 |
| [0010](0010-track-initial-state-in-entities.md) | Track initial holdings inside entities for delta reporting | Accepted | 2023-10-08 |
| [0011](0011-fee-model-per-security-order.md) | Model trading fees per security order | Accepted | 2023-10-08 |
| [0012](0012-validate-data-files-with-zod.md) | Validate data files with zod | Accepted | 2026-10-06 |
| [0013](0013-node22-esm-toolchain.md) | Node 22 native ESM toolchain with tsx | Accepted | 2026-10-06 |
| [0014](0014-mcp-server-interface.md) | Expose the use cases through an MCP server | Accepted | 2026-10-06 |
| [0015](0015-vitest-with-coverage-gate.md) | Unit tests with Vitest and a 95% coverage gate | Accepted | 2026-10-06 |

## Adding an ADR

1. Copy the template below to `NNNN-short-kebab-title.md`, using the next free number.
2. Start with status `Proposed`. Change it to `Accepted` once agreed.
3. Never rewrite an accepted ADR's decision. Write a new ADR, set the old one's status to `Superseded by ADR-NNNN`, and link both ways.
4. Add a row to the index above.

```markdown
# ADR-NNNN: Title

- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNNN
- **Date:** YYYY-MM-DD

## Context

What forces are at play (technical, product, constraints)? What problem needs a decision?

## Decision

What we will do, stated in active voice ("We will …").

## Consequences

What becomes easier or harder: positive, negative, and neutral outcomes, and any follow-up work.
```
