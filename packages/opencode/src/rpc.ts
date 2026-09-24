import { Rpc } from "@opencode/plugin"
import { z } from "zod"

const expression = z.object({ maid: z.string().nullable(), face: z.string() })

export const cafeRpc = Rpc.define({
  id: "claudecafe",
  methods: {
    expression: {
      input: z.object({ sessionID: z.string() }),
      output: expression,
    },
  },
  events: {
    expression: { schema: expression.extend({ sessionID: z.string() }) },
  },
})
