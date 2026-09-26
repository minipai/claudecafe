import { Plugin } from "@opencode/plugin"
import { z } from "zod"
import { characterForMaid, createCafe } from "./cafe.ts"
import { characterIds, syncPublishedCharacters } from "./characters.ts"
import { availableFaceNames, defaultFace, expressionToolDescription, type Expression } from "./expressions.ts"
import { cafeRpc } from "./rpc.ts"

export default Plugin.define({
  id: "claudecafe",
  async setup(context) {
    await syncPublishedCharacters()
    const cafe = createCafe(context.location.directory)
    const abort = new AbortController()
    const allFaces = [...new Set(characterIds().flatMap((id) => availableFaceNames(characterForMaid(id))))]
    const expressionInput = z.object({
      face: z.string().describe("The GIF face to show; it must belong to the active character's installed pixels"),
    })
    let notifyExpression: ((event: { sessionID: string; character: string | null; face: string }) => Promise<void>) | undefined
    const rpc = await context.rpc.register(cafeRpc, {
      expression: async ({ sessionID }) => {
        const character = await cafe.character(sessionID)
        return expressionState(
          await context.storage.get(expressionKey(sessionID)),
          character?.id ?? null,
          availableFaceNames(character),
        )
      },
      selectMaid: async ({ sessionID, maid }) => {
        const character = await cafe.selectMaid(sessionID, maid)
        const value = expressionState(
          await context.storage.get(expressionKey(sessionID)),
          character?.id ?? null,
          availableFaceNames(character),
        )
        await context.storage.set(expressionKey(sessionID), value)
        await notifyExpression?.({ sessionID, ...value })
        return value
      },
    })
    notifyExpression = async (event) => {
      await rpc.events.emit("expression", event)
    }

    void consumeEvents(context.event.subscribe({ signal: abort.signal }), cafe.event)

    await context.session.hook("context", cafe.context)
    await context.tool.transform((tools) => {
      tools.add({
        name: "set_expression",
        description: expressionToolDescription(allFaces),
        input: expressionInput,
        async execute(expression, tool) {
          const character = await cafe.character(tool.sessionID)
          const faces = availableFaceNames(character)
          if (!faces.includes(expression.face)) {
            throw new Error(`Face is not available for ${character?.name ?? "the active character"}`)
          }
          const value: Expression = { character: character?.id ?? null, face: expression.face }
          await context.storage.set(expressionKey(tool.sessionID), value)
          await rpc.events.emit("expression", { sessionID: tool.sessionID, ...value })
          return { content: `Face: ${value.face}` }
        },
      })
    })

    return () => abort.abort()
  },
})

/** Every window keeps its own portrait, so the state is stored per session. */
function expressionKey(sessionID: string): string {
  return `expression:${sessionID}`
}

function expressionState(
  value: unknown,
  character: string | null,
  faces: readonly string[],
): Expression {
  const parsed = z.object({ character: z.string().nullable().optional(), face: z.string() }).safeParse(value)
  if (parsed.success && (parsed.data.character === undefined || parsed.data.character === character) && faces.includes(parsed.data.face)) {
    return { character, face: parsed.data.face }
  }
  return { character, face: defaultFace(faces) }
}

async function consumeEvents(
  events: AsyncIterable<{ type: string; data: Record<string, unknown> }>,
  handle: (event: { type: string; data: Record<string, unknown> }) => void,
): Promise<void> {
  try {
    for await (const event of events) handle(event)
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) throw error
  }
}
