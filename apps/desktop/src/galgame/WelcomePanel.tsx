import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SPOKEN } from './CommandBar'
import { fill, her, LOCALES, text } from '@/i18n'

/**
 * The first thing a machine that has never had her sees. Two languages are
 * asked for, because they are two different things: the window's own wording,
 * and what she answers in — a master may well want her speaking Japanese in an
 * English window.
 *
 * Neither is asked of the model. The window is drawn in the machine's own
 * language until told otherwise, and the shortlist below is written in each
 * language's own script, so this is readable before anything is settled and
 * standing before there is a session to sign in to.
 */
export function WelcomePanel({ open, onDone }: { open: boolean; onDone: () => void }) {
  const t = text().welcome
  const [locale, setLocale] = useState(() => window.cafe?.localeChoice ?? 'system')
  /** Null until he picks one himself: the interface language is a good guess at
   * what he wants her speaking, and following it is better than a default. */
  const [spoken, setSpoken] = useState<string | null>(null)
  const [typed, setTyped] = useState('')

  const drawnIn = locale === 'system' ? (window.cafe?.locale ?? 'en') : locale
  const speaks = typed.trim() || spoken || spokenFor(drawnIn)

  /** The interface redraws as it is picked — including this panel, which is the
   * plainest way of showing what was just chosen. */
  function drawIn(code: string) {
    setLocale(code)
    window.cafe?.setLocale(code)
  }

  function start() {
    window.cafe?.setSpeech(speaks)
    onDone()
  }

  return (
    // Closing it is starting: nothing here is a question she can be left
    // waiting on, and a welcome nobody can get out of is a locked door.
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && start()}>
      <DialogContent
        showCloseButton={false}
        className="w-[min(460px,88vw)] max-w-none gap-0 border border-border bg-card/90 p-0 shadow-xl backdrop-blur-xl sm:max-w-[460px]"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            start()
          }}
        >
          <div className="border-b border-border px-6 py-5">
            <DialogTitle className="text-lg font-semibold text-foreground">{t.title}</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm text-muted-foreground">
              {fill(t.body, { her: her() })}
            </DialogDescription>
          </div>

          <div className="flex flex-col gap-6 px-6 py-5">
            <section>
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">{t.interface}</h2>
              <div className="flex flex-wrap gap-2">
                {LOCALES.map((offered) => (
                  <Button
                    key={offered.code}
                    type="button"
                    size="sm"
                    variant={offered.code === locale ? 'default' : 'outline'}
                    onClick={() => drawIn(offered.code)}
                  >
                    {offered.code === 'system' ? text().bar.system : offered.label}
                  </Button>
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-medium text-muted-foreground">{t.speaks}</h2>
              <div className="flex flex-wrap gap-2">
                {SPOKEN.map((language) => (
                  <Button
                    key={language}
                    type="button"
                    size="sm"
                    variant={!typed.trim() && language === speaks ? 'default' : 'outline'}
                    onClick={() => {
                      setSpoken(language)
                      setTyped('')
                    }}
                  >
                    {language}
                  </Button>
                ))}
              </div>
              {/* Her language is a sentence, not a code — anything written here
                  is handed to her as it stands, and outranks the shortlist. */}
              <input
                name="speech"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={t.otherLanguage}
                aria-label={t.otherLanguage}
                className="mt-2.5 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
              />
            </section>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
            <p className="text-xs text-muted-foreground">{t.later}</p>
            <Button type="submit" size="sm">
              {t.start}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * What a machine set to this is likely to want her speaking. The window itself
 * only exists in two languages, but what she speaks is free text — so the
 * guess follows the machine rather than the two catalogues, and every language
 * on the shortlist above can be guessed rather than only the two.
 */
function spokenFor(code: string) {
  const said = code.toLowerCase()
  if (said.startsWith('ja')) return '日本語'
  if (said.startsWith('ko')) return '한국어'
  // Written Chinese is the split that matters here, and it is not the country:
  // Singapore writes simplified, Hong Kong and Taiwan traditional.
  if (said.startsWith('zh')) return /hans|-cn|-sg/.test(said) ? '简体中文' : '繁體中文'
  return 'English'
}
