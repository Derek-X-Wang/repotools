import { Context, Effect, Layer, Ref } from "effect"
import { FileSystem } from "@effect/platform"
import * as path from "node:path"
import { LinkError } from "../errors.js"

const BIN_DIR = ".repotools/bin"

export interface ToolLink {
  readonly tool: string
  readonly target: string
}

export interface LinkerServiceShape {
  readonly link: (
    tool: string,
    binaryPath: string,
    projectDir: string
  ) => Effect.Effect<void, LinkError>
  readonly listLinks: (
    projectDir: string
  ) => Effect.Effect<Array<ToolLink>>
}

export class LinkerService extends Context.Tag("LinkerService")<
  LinkerService,
  LinkerServiceShape
>() {
  static Live = Layer.effect(
    LinkerService,
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      return LinkerService.of({
        link: (tool, binaryPath, projectDir) =>
          Effect.gen(function* () {
            const binDir = path.join(projectDir, BIN_DIR)
            yield* fs.makeDirectory(binDir, { recursive: true })
            const linkPath = path.join(binDir, tool)
            yield* fs.remove(linkPath).pipe(Effect.ignore)
            yield* fs.symlink(binaryPath, linkPath)
          }).pipe(
            Effect.mapError(
              (e) => new LinkError({ tool, message: `Failed to link ${tool}: ${e}` })
            )
          ),

        listLinks: (projectDir) =>
          Effect.gen(function* () {
            const binDir = path.join(projectDir, BIN_DIR)
            const exists = yield* fs.exists(binDir)
            if (!exists) return []
            const entries = yield* fs.readDirectory(binDir)
            const links: Array<ToolLink> = []
            for (const entry of entries) {
              const linkPath = path.join(binDir, entry)
              const target = yield* fs.readLink(linkPath).pipe(
                Effect.catchAll(() => Effect.succeed(""))
              )
              if (target) links.push({ tool: entry, target })
            }
            return links
          }).pipe(Effect.catchAll(() => Effect.succeed([] as Array<ToolLink>))),
      })
    })
  )

  static Test = () =>
    Layer.effect(
      LinkerService,
      Effect.gen(function* () {
        const store = yield* Ref.make(new Map<string, Array<ToolLink>>())
        return LinkerService.of({
          link: (tool, binaryPath, projectDir) =>
            Ref.update(store, (m) => {
              const links = m.get(projectDir) ?? []
              return new Map([
                ...m,
                [projectDir, [...links.filter((l) => l.tool !== tool), { tool, target: binaryPath }]],
              ])
            }),
          listLinks: (projectDir) =>
            Ref.get(store).pipe(Effect.map((m) => m.get(projectDir) ?? [])),
        })
      })
    )
}
