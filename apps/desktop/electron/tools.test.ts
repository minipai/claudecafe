import { describe, expect, it } from 'vitest'
import { cafeTools, EXPRESSION_TOOL } from './tools'

/**
 * translate.ts keys tool_use blocks off EXPRESSION_TOOL by string equality —
 * nothing in the types ties it back to the server actually registered below.
 * A rename of the server or of the tool would orphan translate.ts's keying
 * silently, so this reads the live registration rather than trusting a second
 * hand-written copy.
 */
describe('EXPRESSION_TOOL', () => {
  it('names the server cafeTools was actually built with', () => {
    expect(EXPRESSION_TOOL).toBe(`mcp__${cafeTools.name}__expression`)
  })

  it('names tools cafeTools actually registered', () => {
    const instance = cafeTools.instance as unknown as { _registeredTools: Record<string, unknown> }
    const registered = Object.keys(instance._registeredTools)
    expect(registered).toContain('expression')
  })
})
