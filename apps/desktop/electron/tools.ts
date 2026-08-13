import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { EXPRESSIONS } from '../src/agent/expressions'

/**
 * The two things the maid can do to the scene she is standing in, handed to her
 * as tools: change the face beside the name plate, and hand over a written
 * report the window keeps behind a "View full report" link instead of reading
 * it out loud.
 *
 * The effect is taken from the tool-use block as it streams past (translate.ts)
 * rather than from these handlers — by the time a handler runs the window has
 * already reacted, so all it has to do is say yes.
 */
export const EXPRESSION_TOOL = 'mcp__cafe__expression'
export const REPORT_TOOL = 'mcp__cafe__report'

const done = (text: string) => ({ content: [{ type: 'text' as const, text }] })

export const cafeTools = createSdkMcpServer({
  name: 'cafe',
  version: '1.0.0',
  tools: [
    tool(
      'expression',
      "Change the maid's face in the window. Call it whenever her mood changes — "
        + 'thinking while she reads, focused while digging through the work, proud '
        + 'once it lands, sad when she has to say no. The face stays until the next '
        + 'call, and it is the same set of moods her reply markers use.',
      { expression: z.enum(EXPRESSIONS) },
      async ({ expression }) => done(`Now wearing: ${expression}`),
    ),
    tool(
      'report',
      'Hand the master a written report instead of saying it out loud. Use this '
        + 'for anything longer than a couple of sentences — an investigation, a '
        + 'walkthrough, a comparison, anything with headings or code blocks. She '
        + 'says `line` in the scene and the body waits behind a link the master '
        + 'can open. Do not repeat the body in your reply afterwards.',
      {
        line: z.string().describe('The one sentence she says out loud while handing it over.'),
        label: z
          .string()
          .describe(
            'The words written on the link that opens it — a few, in her voice and '
              + "the master's language, naming what is inside. \"Read the whole "
              + 'investigation →\", "看看ことね查到什麼 →".',
          ),
        body: z.string().describe('The writing itself, as markdown.'),
      },
      async () => done('Report delivered — the master can open it from the scene.'),
    ),
  ],
})
