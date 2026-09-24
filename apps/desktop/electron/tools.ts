import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { EXPRESSIONS } from '../src/agent/expressions'

/**
 * The one thing the maid can do to the scene she is standing in, handed to her
 * as a tool: change the face beside the name plate.
 *
 * The effect is taken from the tool-use block as it streams past (translate.ts)
 * rather than from this handler — by the time it runs the window has already
 * reacted, so all it has to do is say yes.
 */
export const EXPRESSION_TOOL = 'mcp__cafe__expression'

const done = (text: string) => ({ content: [{ type: 'text' as const, text }] })

export const cafeTools = createSdkMcpServer({
  name: 'cafe',
  version: '1.0.0',
  tools: [
    tool(
      'expression',
      "Change the maid's face in the window. Call it whenever her mood changes — "
        + 'thinking while she works something out, focused once she rolls her sleeves '
        + 'up, excited when the master beats her to it, sorry when she has broken '
        + 'something. The face stays until the next call, and it is the same set of '
        + 'moods her reply markers use.',
      { expression: z.enum(EXPRESSIONS) },
      async ({ expression }) => done(`Now wearing: ${expression}`),
    ),
  ],
})
