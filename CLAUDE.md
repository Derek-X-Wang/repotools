# repotools

Declarative CLI tool manager for repositories. TypeScript + Bun + Effect v3.

## Runtime

- **Always use Bun**, not Node.js / npm / pnpm / yarn
- `bun install` for dependencies
- `bun run src/cli.ts` to run the CLI in dev
- `bun build src/cli.ts --compile --outfile repotools` to compile
- `bunx vitest run` for tests (NOT `bun test` — `@effect/vitest` requires the vitest runner)
- `bun run typecheck` for type checking

## Architecture

- Effect v3 with `Context.Tag` services (NOT `Effect.Service`)
- `Schema.TaggedError` for all errors — never raw `throw` or `Error`
- `Schema.parseJson` for JSON decoding — never raw `JSON.parse`
- `@effect/platform` FileSystem for file I/O in services (not raw `Bun.file()`)
- Every side-effectful operation behind a service with `Live` and `Test` layers
- Commands in `src/commands/`, services in `src/services/`
- Layer composition at the CLI entrypoint (`src/cli.ts`)

## Testing

- Use `@effect/vitest` with `it.effect()` for Effect-based tests
- Run tests via `bunx vitest run`, not `bun test`
- Every service has a `Test` static layer using `Ref` for in-memory state
