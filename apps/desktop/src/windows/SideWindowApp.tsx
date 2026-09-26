import { useEffect, useState, type ReactNode } from 'react'
import { nowServing, speakThis, text } from '@/i18n'
import { watchScene } from '@/agent/windows'
import type { SceneShare, SideWindow } from '@/agent'
import { LogWindow } from './conversation/LogWindow'
import { ReplyWindow } from './conversation/ReplyWindow'
import { SettingsWindow } from './settings/SettingsWindow'
import { ProjectsWindow } from './projects/ProjectsWindow'
import { UsageWindow } from './UsageWindow'

/**
 * A side window draws nothing until the scene has shared itself: what it would
 * draw is the scene's, down to the language and her name.
 */
export function SideWindowApp({ name }: { name: SideWindow }) {
  const [scene, setScene] = useState<SceneShare | null>(null)
  const view = views[name]

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
    if (scene) document.title = view.title()
  }, [view, scene])

  if (!scene) return <main className="min-h-screen bg-card" />
  return view.render(scene)
}

const views: Record<SideWindow, { title: () => string; render: (scene: SceneShare) => ReactNode }> = {
  log: {
    title: () => text().bar.log,
    render: (scene) => <LogWindow log={scene.log} conversation={scene.conversation} />,
  },
  reply: {
    title: () => text().reply.title,
    render: (scene) => <ReplyWindow log={scene.log} todos={scene.todos} />,
  },
  settings: {
    title: () => text().settings.title,
    render: (scene) => <SettingsWindow settings={scene.settings} />,
  },
  projects: {
    title: () => text().projects.title,
    render: (scene) => <ProjectsWindow folder={scene.folder} conversation={scene.conversation} />,
  },
  usage: {
    title: () => text().bar.usage,
    render: () => <UsageWindow />,
  },
}
