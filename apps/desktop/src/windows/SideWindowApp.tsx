import { useEffect, useState } from 'react'
import { nowServing, speakThis, text } from '@/i18n'
import { watchScene } from '@/agent/windows'
import type { SceneShare, SideWindow } from '@/agent'
import { LogWindow } from './LogWindow'
import { SettingsWindow } from './SettingsWindow'
import { ProjectsWindow } from './ProjectsWindow'
import { SessionWindow } from './session/SessionWindow'
import { ReportWindow } from './ReportWindow'

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
    if (scene) document.title = titleOf(name, scene)
  }, [name, scene])

  if (!scene) return <main className="min-h-screen bg-card" />
  if (name === 'log') return <LogWindow log={scene.log} conversation={scene.conversation} />
  if (name === 'settings') return <SettingsWindow settings={scene.settings} />
  if (name === 'projects') return <ProjectsWindow folder={scene.folder} conversation={scene.conversation} />
  if (name === 'session') return <SessionWindow session={scene.session} />
  return <ReportWindow report={scene.report} />
}

function titleOf(name: SideWindow, scene: SceneShare) {
  const t = text()
  if (name === 'log') return t.bar.log
  if (name === 'settings') return t.settings.title
  if (name === 'projects') return t.projects.title
  if (name === 'session') return t.session.title
  // The link under the box names the report; the arrow is only there to be clicked.
  return scene.report?.label.replace(/\s*→$/, '') ?? t.report.title
}
