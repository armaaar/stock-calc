# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-06

## Context

The project has grown over several years (2022–2024) through small commits. The reasons behind its structure (layering, scraping strategy, numeric types, file formats) exist only in the code and in terse commit messages. Contributors, human or AI, have to reverse-engineer them before making changes.

## Decision

We will keep Architecture Decision Records in `docs/architecture/adr/`, using the Nygard format described in the [ADR index](README.md). Existing decisions are recorded retroactively, dated by the commit that introduced them.

## Consequences

- New architecturally significant changes (new layer, new external dependency, change of data format or price source strategy) come with an ADR.
- Retroactive ADRs reconstruct rationale from code and history, so they may describe intent less precisely than an ADR written at decision time.
