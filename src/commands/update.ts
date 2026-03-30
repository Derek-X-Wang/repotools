import { Command } from "@effect/cli"
import { Effect } from "effect"
import { ConfigService } from "../services/config.js"
import { ResolverService } from "../services/resolver.js"
import { DownloaderService } from "../services/downloader.js"
import { CacheService } from "../services/cache.js"
import { LinkerService } from "../services/linker.js"

export const updateCommand = Command.make("update", {}, () =>
  Effect.gen(function* () {
    const config = yield* ConfigService
    const resolver = yield* ResolverService
    const downloader = yield* DownloaderService
    const cache = yield* CacheService
    const linker = yield* LinkerService

    const cwd = process.cwd()
    const repoConfig = yield* config.load(cwd)

    for (const [name, toolConfig] of Object.entries(repoConfig.tools)) {
      yield* Effect.log(`Checking ${name}...`)
      const resolved = yield* resolver.resolve(toolConfig, name)
      const alreadyCached = yield* cache.isCached(name, resolved.version)

      if (alreadyCached) {
        yield* Effect.log(`${name}@${resolved.version} is up to date`)
      } else {
        yield* Effect.log(`Updating ${name} to ${resolved.version}...`)
        const binary = yield* downloader.download(
          resolved.downloadUrl,
          resolved.assetName,
          name
        )
        yield* cache.store(name, resolved.version, binary)
        const binaryPath = yield* cache.getBinaryPath(name, resolved.version)
        yield* linker.link(name, binaryPath, cwd)
        yield* Effect.log(`Updated ${name}@${resolved.version}`)
      }
    }

    yield* Effect.log("Update complete")
  })
).pipe(Command.withDescription("Check for and install newer tool versions"))
