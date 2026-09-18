import { Plugin } from "@opencode/plugin"
import { z } from "zod"
import { createCafe } from "./cafe.ts"
import { EXPRESSIONS, expressionToolDescription } from "./expressions.ts"
import { cafeRpc } from "./rpc.ts"

const expressionInput = z.object({ expression: z.enum(EXPRESSIONS) })

export default Plugin.define({
  id: "claudecafe",
  async setup(context) {
    const cafe = createCafe(context.location.directory)
    const abort = new AbortController()
    const rpc = await context.rpc.register(cafeRpc, {
      expression: async () => expressionState(await context.storage.get("expression")),
    })

    void consumeEvents(context.event.subscribe({ signal: abort.signal }), cafe.event)

    await context.session.hook("context", cafe.context)
    await context.tool.transform((tools) => {
      tools.add({
        name: "set_expression",
        description: expressionToolDescription,
        input: expressionInput,
        async execute({ expression }) {
          await context.storage.set("expression", { value: expression })
          await rpc.events.emit("expression", { expression })
          return { content: `Expression: ${expression}` }
        },
      })
    })

    return () => abort.abort()
  },
})

function expressionState(value: unknown): { expression: (typeof EXPRESSIONS)[number] } {
  const parsed = z.object({ value: z.enum(EXPRESSIONS) }).safeParse(value)
  return { expression: parsed.success ? parsed.data.value : "neutral" }
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
