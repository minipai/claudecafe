import { useEffect, useState } from 'react'
import { nowServing, speakThis, text } from '@/i18n'
import { watchScene } from '@/agent/windows'
import type { SceneShare, SideWindow } from '@/agent'
import { LogWindow } from './LogWindow'
import { SettingsWindow } from './SettingsWindow'

/**
 * A side window draws nothing until the scene has shared itself: what it would
 * draw is the scene's, down to the language and her name.
 */
export function SideWindowApp({ name }: { name: SideWindow }) {
  const [scene, setScene] = useState<SceneShare | null>(null)

  useEffect(
    () =>
      watchScene((shared) => {
        speakThis(shared.locale)
        nowServing(shared.maidName)
        setScene(shared)
      }),
    [],
  )

  useEffect(() => {
    if (!scene) return
    document.title = name === 'log' ? text().bar.log : text().settings.title
  }, [name, scene])

  if (!scene) return <main className="min-h-screen bg-card" />
  return name === 'log' ? <LogWindow log={scene.log} /> : <SettingsWindow settings={scene.settings} />
}
