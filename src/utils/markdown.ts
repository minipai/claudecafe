import { marked } from 'marked'

const renderer = new marked.Renderer()

renderer.heading = ({ text, depth }) => {
  const hashes = '#'.repeat(depth)
  return `<h${depth}><span class="md-hash">${hashes}</span> ${text}</h${depth}>`
}

renderer.listitem = ({ text }) => {
  return `<li><span class="md-hash">-</span> ${text}</li>`
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, renderer }) as string
}

export function renderBlogMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string
}
