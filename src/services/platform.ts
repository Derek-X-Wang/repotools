import { Context, Effect, Layer } from "effect"
import { UnsupportedPlatformError } from "../errors.js"

export type OS = "darwin" | "linux" | "windows"
export type Arch = "arm64" | "x64"

export interface PlatformInfo {
  readonly os: OS
  readonly arch: Arch
}

export interface PlatformServiceShape {
  readonly detect: () => Effect.Effect<PlatformInfo, UnsupportedPlatformError>
}

export class PlatformService extends Context.Tag("PlatformService")<
  PlatformService,
  PlatformServiceShape
>() {
  static Live = Layer.succeed(PlatformService, {
    detect: () =>
      Effect.try({
        try: () => {
          const osMap: Record<string, OS> = {
            darwin: "darwin",
            linux: "linux",
            win32: "windows",
          }
          const archMap: Record<string, Arch> = {
            arm64: "arm64",
            x64: "x64",
            aarch64: "arm64",
          }
          const os = osMap[process.platform]
          const arch = archMap[process.arch]
          if (!os || !arch) throw new Error("unsupported")
          return { os, arch } as PlatformInfo
        },
        catch: () =>
          new UnsupportedPlatformError({
            os: process.platform,
            arch: process.arch,
            message: `Unsupported platform: ${process.platform}-${process.arch}`,
          }),
      }),
  })

  static Test = (info: PlatformInfo) =>
    Layer.succeed(PlatformService, {
      detect: () => Effect.succeed(info),
    })
}
