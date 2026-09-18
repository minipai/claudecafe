import { Rpc } from "@opencode/plugin"
import { z } from "zod"
import { EXPRESSIONS } from "./expressions.ts"

const expression = z.object({ expression: z.enum(EXPRESSIONS) })

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
