import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { LOCALES, SPOKEN, text } from '@/i18n'
import { sendToScene } from '@/agent/windows'
import type { SceneAction, SceneShare } from '@/agent'
import { BackdropPicker } from './BackdropPicker'

/**
 * What the café looks and sounds like, in a window of its own: the language the
 * window is drawn in, the one she speaks, and the room behind her. Each choice
 * is sent to the scene, which keeps it — this window only shows what the scene
 * says is chosen now.
 */
export function SettingsWindow({ settings }: { settings: SceneShare['settings'] }) {
  const t = text()
  const { locale, speech, backdrop } = settings
  /** Her language written out, when none of the usual ones will do. */
  const [typed, setTyped] = useState('')

  return (
    <main className="min-h-screen bg-card text-card-foreground">
      <h1 className="border-b border-border px-6 py-3 text-sm font-medium">{t.settings.title}</h1>

      <div className="flex flex-col gap-7 px-6 py-5">
        <Section title={t.bar.locale}>
          {LOCALES.map((offered) => (
            <Choice
              key={offered.code}
              label={offered.code === 'system' ? t.bar.system : offered.label}
              chosen={offered.code === locale}
              action={{ kind: 'locale', choice: offered.code }}
            />
          ))}
        </Section>

        <Section title={t.bar.speech}>
          <Choice label={t.bar.followCafe} chosen={!speech.chosen} action={{ kind: 'speech', language: '' }} />
          {SPOKEN.map((language) => (
            <Choice
              key={language}
              label={language}
              chosen={language === speech.chosen}
              action={{ kind: 'speech', language }}
            />
          ))}
          {/* Her language is a sentence, not a code — anything written here is
              handed to her as it stands. */}
          <form
            className="mt-1 flex w-full gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (!typed.trim()) return
              sendToScene({ kind: 'speech', language: typed.trim() })
              setTyped('')
            }}
          >
            <input
              name="speech"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={speech.chosen && !SPOKEN.includes(speech.chosen) ? speech.chosen : t.bar.speakHint}
              aria-label={t.bar.speakHint}
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />
            <Button type="submit" size="sm" variant="outline" disabled={!typed.trim()}>
              {t.settings.speak}
            </Button>
          </form>
        </Section>

        <Section title={t.bar.backdrop}>
          <BackdropPicker chosen={backdrop} onChoose={(chosen) => sendToScene({ kind: 'backdrop', backdrop: chosen })} />
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

function Choice({ label, chosen, action }: { label: string; chosen: boolean; action: SceneAction }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        sendToScene(action)
      }}
    >
      <Button type="submit" size="sm" variant={chosen ? 'default' : 'outline'} aria-pressed={chosen}>
        {label}
      </Button>
    </form>
  )
}
