import { Context, Effect, Layer, Ref } from "effect"
import { Schema } from "effect"
import { FileSystem } from "@effect/platform"
import { RepoToolsConfig } from "../schema/config.js"
import { ConfigNotFoundError, ConfigParseError } from "../errors.js"

const CONFIG_FILENAME = "repotools.json"
const decodeConfig = Schema.decodeUnknown(Schema.parseJson(RepoToolsConfig))

export interface ConfigServiceShape {
  readonly load: (
    cwd: string
  ) => Effect.Effect<RepoToolsConfig, ConfigNotFoundError | ConfigParseError>
}

export class ConfigService extends Context.Tag("ConfigService")<
  ConfigService,
  ConfigServiceShape
>() {
  static Live = Layer.effect(
    ConfigService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      return ConfigService.of({
        load: (cwd) =>
          Effect.gen(function* () {
            const configPath = `${cwd}/${CONFIG_FILENAME}`
            const content = yield* fs.readFileString(configPath).pipe(
              Effect.mapError(
                () =>
                  new ConfigNotFoundError({
                    path: configPath,
                    message: `Config file not found: ${configPath}`,
                  })
              )
            )
            return yield* decodeConfig(content).pipe(
              Effect.mapError(
                (e) =>
                  new ConfigParseError({
                    message: `Invalid config: ${e.message}`,
                  })
              )
            )
          }),
      })
    })
  )

  static Test = (files: Record<string, string> = {}) =>
    Layer.effect(
      ConfigService,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map(Object.entries(files)))
        return ConfigService.of({
          load: (cwd) =>
            Effect.gen(function* () {
              const configPath = `${cwd}/${CONFIG_FILENAME}`
              const fileMap = yield* Ref.get(store)
              const content = fileMap.get(configPath)
              if (!content) {
                return yield* Effect.fail(
                  new ConfigNotFoundError({
                    path: configPath,
                    message: `Config file not found: ${configPath}`,
                  })
                )
              }
              return yield* decodeConfig(content).pipe(
                Effect.mapError(
                  (e) =>
                    new ConfigParseError({
                      message: `Invalid config: ${e.message}`,
                    })
                )
              )
            }),
        })
      })
    )
}
