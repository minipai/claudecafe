import { Rpc } from "@opencode/plugin"
import { z } from "zod"

const expression = z.object({ mood: z.string(), face: z.string() })

export const cafeRpc = Rpc.define({
  id: "claudecafe",
  methods: {
    expression: {
      input: z.object({}),
      output: expression,
    },
  },
  events: {
    expression: { schema: expression },
  },
})
