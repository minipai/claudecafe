import { en, type Text } from './en'
import { zhTW } from './zh-TW'

export type { Text }

/**
 * The interface's language, which is not hers. This one is a code — `en-AU`,
 * `zh-TW` — because it picks a translation of a fixed set of words, and the
 * codes are what the system reports and what `Intl` takes. What she speaks is
 * a sentence in the café's own settings, and is left well alone here.
 */
export const CATALOGUES: Record<string, Text> = {
  en,
  'zh-TW': zhTW,
}

/** Offered by name in the language itself — nobody looks for their own language
 * under someone else's word for it. `system` follows what the machine is set to. */
export const LOCALES = [
  { code: 'system', label: 'System' },
  { code: 'en', label: 'English' },
  { code: 'zh-TW', label: '繁體中文' },
]

/**
 * Which catalogue a locale code lands on. Region is dropped when there is no
 * translation for it: `en-AU` and `en-GB` read the same words, and a Taiwanese
 * `zh-TW` is not the same as `zh-CN`, which is why only the one that exists is
 * matched exactly.
 */
export function readLocale(code: string | null | undefined): Text {
  if (!code) return en
  const wanted = code.replace('_', '-')
  return CATALOGUES[wanted] ?? CATALOGUES[wanted.split('-')[0]] ?? en
}

let spoken: Text = en

/** Read at the moment of drawing, never kept: the language can be switched
 * while the window is open. */
export const text = () => spoken

export function speakThis(code: string | null | undefined) {
  spoken = readLocale(code)
  return spoken
}

/** `Always allow {what}` with the what in it. No plurals, no genders — the
 * catalogue carries a separate key wherever a language needs one. */
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (whole, key) => String(values[key] ?? whole))
}
