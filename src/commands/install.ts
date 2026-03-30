import { Command } from "@effect/cli"
import { Effect } from "effect"
import { ConfigService } from "../services/config.js"
import { ResolverService } from "../services/resolver.js"
import { DownloaderService } from "../services/downloader.js"
import { CacheService } from "../services/cache.js"
import { LinkerService } from "../services/linker.js"

export const installHandler = (cwd: string) =>
  Effect.gen(function* () {
    const config = yield* ConfigService
    const resolver = yield* ResolverService
    const downloader = yield* DownloaderService
    const cache = yield* CacheService
    const linker = yield* LinkerService

    const repoConfig = yield* config.load(cwd)

    for (const [name, toolConfig] of Object.entries(repoConfig.tools)) {
      const resolved = yield* resolver.resolve(toolConfig, name)
      const alreadyCached = yield* cache.isCached(name, resolved.version)

      if (alreadyCached) {
        yield* Effect.log(`${name}@${resolved.version} already cached, skipping`)
      } else {
        yield* Effect.log(`Downloading ${name}@${resolved.version}...`)
        const binary = yield* downloader.download(
          resolved.downloadUrl,
          resolved.assetName,
          name
        )
        yield* cache.store(name, resolved.version, binary)
        yield* Effect.log(`Cached ${name}@${resolved.version}`)
      }

      const binaryPath = yield* cache.getBinaryPath(name, resolved.version)
      yield* linker.link(name, binaryPath, cwd)
      yield* Effect.log(`Linked ${name} -> ${binaryPath}`)
    }

    yield* Effect.log("Install complete")
  })

export const installCommand = Command.make(
  "install",
  {},
  () => installHandler(process.cwd())
).pipe(Command.withDescription("Install tools defined in repotools.json"))
