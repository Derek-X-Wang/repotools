import { Context, Effect, Layer, Ref } from "effect"
import { FileSystem } from "@effect/platform"
import * as path from "node:path"
import * as os from "node:os"
import { DownloadError } from "../errors.js"

const CACHE_ROOT = path.join(os.homedir(), ".repotools", "cache")

export interface CacheServiceShape {
  readonly toolPath: (tool: string, version: string) => Effect.Effect<string>
  readonly isCached: (tool: string, version: string) => Effect.Effect<boolean>
  readonly store: (tool: string, version: string, binary: Uint8Array) => Effect.Effect<void, DownloadError>
  readonly getBinaryPath: (tool: string, version: string) => Effect.Effect<string>
}

export class CacheService extends Context.Tag("CacheService")<
  CacheService,
  CacheServiceShape
>() {
  static Live = Layer.effect(
    CacheService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      return CacheService.of({
        toolPath: (tool, version) =>
          Effect.succeed(path.join(CACHE_ROOT, tool, version)),

        isCached: (tool, version) => {
          const binPath = path.join(CACHE_ROOT, tool, version, tool)
          return fs.exists(binPath).pipe(Effect.catchAll(() => Effect.succeed(false)))
        },

        store: (tool, version, binary) =>
          Effect.gen(function* () {
            const dir = path.join(CACHE_ROOT, tool, version)
            yield* fs.makeDirectory(dir, { recursive: true })
            const binPath = path.join(dir, tool)
            yield* fs.writeFile(binPath, binary)
            yield* fs.chmod(binPath, 0o755)
          }).pipe(
            Effect.mapError(
              (e) =>
                new DownloadError({
                  url: "cache",
                  message: `Failed to store ${tool}@${version}: ${e}`,
                })
            )
          ),

        getBinaryPath: (tool, version) =>
          Effect.succeed(path.join(CACHE_ROOT, tool, version, tool)),
      })
    })
  )

  static Test = () =>
    Layer.effect(
      CacheService,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map<string, Uint8Array>())
        const key = (tool: string, version: string) => `${tool}@${version}`
        return CacheService.of({
          toolPath: (tool, version) =>
            Effect.succeed(`/mock-cache/${tool}/${version}`),
          isCached: (tool, version) =>
            Ref.get(store).pipe(Effect.map((m) => m.has(key(tool, version)))),
          store: (tool, version, binary) =>
            Ref.update(store, (m) => new Map([...m, [key(tool, version), binary]])),
          getBinaryPath: (tool, version) =>
            Effect.succeed(`/mock-cache/${tool}/${version}/${tool}`),
        })
      })
    )
}
