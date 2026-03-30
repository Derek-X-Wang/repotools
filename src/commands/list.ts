import { Command } from "@effect/cli"
import { Effect } from "effect"
import { LinkerService } from "../services/linker.js"

export const listCommand = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const linker = yield* LinkerService
    const links = yield* linker.listLinks(process.cwd())

    if (links.length === 0) {
      yield* Effect.log("No tools installed. Run `repotools install` first.")
      return
    }

    yield* Effect.log("Installed tools:")
    for (const link of links) {
      yield* Effect.log(`  ${link.tool} -> ${link.target}`)
    }
  })
).pipe(Command.withDescription("List installed tools and their versions"))
