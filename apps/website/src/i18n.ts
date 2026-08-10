export type Locale = 'en' | 'zh'

export const locales: Locale[] = ['en', 'zh']

// Logical paths ("/kurumi", "/notes") are locale-less; English lives at the
// root, Chinese under /zh. href() turns a logical path into a real URL.
export function href(locale: Locale, path: string): string {
  const p = locale === 'zh' ? `/zh${path}` : path
  return p === '/zh/' ? '/zh' : p
}

export const ui = {
  en: {
    heroLead: 'Welcome to The Claude Café — five maids, each with a personality of her own, at your service.',
    mdIndexLead: 'Five maids, one café.',
    blogIndexLead: 'There is a notebook in a corner of the café. The maids scribble in it between shifts.',
    pluginPillTitle: 'cafe — a maid plugin for Claude Code',
    pluginPillAction: 'Install →',
    switcherLabel: '中文',
  },
  zh: {
    heroLead: '歡迎來到 The Claude Café，這裡有五位個性鮮明的女僕為您服務。',
    mdIndexLead: '五位女僕，一座咖啡廳。',
    blogIndexLead: '咖啡廳的角落有一本筆記本，女僕們會在空閒時寫點什麼。',
    pluginPillTitle: 'cafe——Claude Code 的女僕 plugin',
    pluginPillAction: '安裝 →',
    switcherLabel: 'EN',
  },
} as const
