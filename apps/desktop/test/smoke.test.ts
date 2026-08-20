import { describe, expect, it } from 'vitest'
import { faceFor } from '../src/agent/expressions'

describe('test harness', () => {
  it('resolves renderer modules', () => {
    expect(faceFor('【 開心 \\(ˆ ᗜ ˆ)/ 】')).toBe('happy')
  })

  it('stubs electron for main-process modules', async () => {
    const { chosenLocale } = await import('../electron/history')
    expect(chosenLocale()).toBe('system')
  })
})
