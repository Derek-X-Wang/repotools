#!/usr/bin/env bun
import { Command } from "@effect/cli"
import { BunContext, BunRuntime } from "@effect/platform-bun"
import { Effect, Layer } from "effect"
import { rootCommand } from "./commands.js"
import { ConfigService } from "./services/config.js"
import { GithubApiService } from "./services/github-api.js"
import { ResolverService } from "./services/resolver.js"
import { DownloaderService } from "./services/downloader.js"
import { CacheService } from "./services/cache.js"
import { LinkerService } from "./services/linker.js"
import { PlatformService } from "./services/platform.js"

// Services that need @effect/platform FileSystem (provided by BunContext)
const FsServicesLayer = Layer.mergeAll(
  ConfigService.Live,
  CacheService.Live,
  LinkerService.Live
).pipe(Layer.provide(BunContext.layer))

// ResolverService depends on PlatformService + GithubApiService
const ResolverLayer = ResolverService.Live.pipe(
  Layer.provide(Layer.mergeAll(PlatformService.Live, GithubApiService.Live))
)

// Combine all services
const AppLayer = Layer.mergeAll(
  FsServicesLayer,
  ResolverLayer,
  DownloaderService.Live,
  PlatformService.Live,
  GithubApiService.Live,
  BunContext.layer
)

const cli = Command.run(rootCommand, {
  name: "repotools",
  version: "0.1.0",
})

cli(process.argv).pipe(Effect.provide(AppLayer), BunRuntime.runMain)
