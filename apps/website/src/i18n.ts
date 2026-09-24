export type Locale = 'en' | 'zh'

export const locales: Locale[] = ['en', 'zh']

// Logical paths ("/kurumi", "/plugin") are locale-less; English lives at the
// root, Chinese under /zh. href() turns a logical path into a real URL.
export function href(locale: Locale, path: string): string {
  const p = locale === 'zh' ? `/zh${path}` : path
  return p === '/zh/' ? '/zh' : p
}

export const ui = {
  en: {
    mdIndexLead: 'Five maids, one café.',
    switcherLabel: '中文',
  },
  zh: {
    mdIndexLead: '五位女僕，一座咖啡廳。',
    switcherLabel: 'EN',
  },
} as const
