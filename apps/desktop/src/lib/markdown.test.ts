// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderInlineMarkdown, renderMarkdown } from './markdown'

describe('markdown rendering', () => {
  it('keeps rich Markdown while neutralizing executable markup and URLs', () => {
    const html = renderMarkdown([
      '# Heading',
      '',
      '- **bold** and `code`',
      '- [safe](https://example.com)',
      '',
      '<img src=x onerror="alert(1)">',
      '<script>alert(1)</script>',
      '[bad](javascript:alert(1))',
    ].join('\n'))

    expect(html).toContain('<h1>Heading</h1>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('href="https://example.com"')
    expect(html).not.toMatch(/onerror|<script|href="javascript:/i)
  })

  it('keeps inline rendering inline and preserves source newlines', () => {
    expect(renderInlineMarkdown('**bold**\nsecond')).toContain('<br>')
    expect(renderInlineMarkdown('**bold**')).toBe('<strong>bold</strong>')
  })
})
