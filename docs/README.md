# Documentation

Documentation for **stock-calc**, a CLI that tells you how many shares of each security to hold or trade so a portfolio matches its target allocation.

For installing and using the CLI, see the [project README](../README.md).

## Architecture

- [Architecture overview](architecture/overview.md): system context, layers, runtime flows, external dependencies, and extension points.
- [Architecture Decision Records](architecture/adr/README.md): why the system is built the way it is.

## Domain (DDD)

- [Domain overview](domain/README.md): subdomains, bounded contexts, and the context map.
- [Ubiquitous language](domain/ubiquitous-language.md): the glossary shared by code, docs, and CLI output.
- [Portfolio Allocation context](domain/portfolio-allocation.md): the core domain model (aggregate, entities, invariants, fee model).
- [Market Data context](domain/market-data.md): how security prices are obtained and turned into domain objects.
- [Use cases](domain/use-cases.md): the application services behind each CLI command.
