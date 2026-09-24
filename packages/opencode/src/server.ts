import { Plugin } from "@opencode/plugin"
import { z } from "zod"
import { createCafe } from "./cafe.ts"
import {
  defaultFace,
  expressionToolDescription,
  loadFaceNames,
  type Expression,
} from "./expressions.ts"
import { cafeRpc } from "./rpc.ts"

export default Plugin.define({
  id: "claudecafe",
  async setup(context) {
    const cafe = createCafe(context.location.directory)
    const abort = new AbortController()
    const faces = loadFaceNames()
    const fallbackFace = defaultFace(faces)
    const expressionInput = z.object({
      face: z.enum(faces).describe("The GIF portrait to show; values come from the installed face filenames"),
    })
    const rpc = await context.rpc.register(cafeRpc, {
      expression: async ({ sessionID }) =>
        expressionState(await context.storage.get(expressionKey(sessionID)), faces, fallbackFace),
    })

    void consumeEvents(context.event.subscribe({ signal: abort.signal }), cafe.event)

    await context.session.hook("context", cafe.context)
    await context.tool.transform((tools) => {
      tools.add({
        name: "set_expression",
        description: expressionToolDescription(faces),
        input: expressionInput,
        async execute(expression, tool) {
          await context.storage.set(expressionKey(tool.sessionID), expression)
          await rpc.events.emit("expression", { sessionID: tool.sessionID, ...expression })
          return { content: `Face: ${expression.face}` }
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
  faces: readonly [string, ...string[]],
  fallbackFace: string,
): Expression {
  const parsed = z.object({ face: z.enum(faces) }).safeParse(value)
  return parsed.success ? parsed.data : { face: fallbackFace }
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
