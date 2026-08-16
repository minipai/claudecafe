import { describe, expect, it } from 'vitest'
import { en } from './en'
import { zhTW } from './zh-TW'
import { fill, readLocale } from './index'

describe('readLocale', () => {
  it('matches a catalogue exactly', () => {
    expect(readLocale('zh-TW')).toBe(zhTW)
  })

  it('falls back to the base language when the region has no translation', () => {
    expect(readLocale('en-AU')).toBe(en)
  })

  it('does not fall back a regioned code to a different regioned catalogue — zh-CN is not zh-TW', () => {
    expect(readLocale('zh-CN')).toBe(en)
  })

  it('falls back to English for a language nobody has written', () => {
    expect(readLocale('fr-FR')).toBe(en)
  })

  it('falls back to English when there is no code at all', () => {
    expect(readLocale(null)).toBe(en)
    expect(readLocale(undefined)).toBe(en)
    expect(readLocale('')).toBe(en)
  })

  it('normalises underscores to hyphens before matching', () => {
    expect(readLocale('zh_TW')).toBe(zhTW)
  })
})

describe('fill', () => {
  it('replaces a placeholder with the given value', () => {
    expect(fill('Always allow {what}', { what: 'Bash git' })).toBe('Always allow Bash git')
  })

  it('replaces more than one placeholder', () => {
    expect(fill('{count} of {total}', { count: 1, total: 3 })).toBe('1 of 3')
  })

  it('leaves an unknown placeholder untouched', () => {
    expect(fill('Handed over {count} images', {})).toBe('Handed over {count} images')
  })
})
