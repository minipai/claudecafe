import createDOMPurify from 'dompurify'
import { marked } from 'marked'

const DOMPurify = createDOMPurify(window)

/** Render model-authored Markdown as inert HTML before it reaches React. */
export function renderMarkdown(source: string, breaks = true) {
  return DOMPurify.sanitize(marked.parse(source, { async: false, breaks }))
}

/** Render inline speech as Markdown without adding block-level formatting. */
export function renderInlineMarkdown(source: string) {
  return DOMPurify.sanitize(marked.parseInline(source, { async: false, breaks: true }))
}
