import { useState } from 'react'
import { text } from '@/i18n'
import type { ModelChoice, SessionSettings } from '@/agent'
import { sendToScene } from '@/agent/windows'

const EFFORTS: SessionSettings['effort'][] = ['low', 'medium', 'high', 'xhigh', 'max']

export function ModelsWindow({ settings, models }: { settings: SessionSettings; models: ModelChoice[] }) {
  const [query, setQuery] = useState('')
  const selectedModel = settings.model ?? 'default'
  const currentEfforts = models.find((model) => model.value === selectedModel)?.efforts
  const efforts = currentEfforts?.length ? currentEfforts : EFFORTS
  const shown = models.filter((model) => `${model.label} ${model.value}`.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <main className="flex h-screen flex-col bg-card text-card-foreground">
      <header className="border-b border-border px-5 py-3">
        <h1 className="text-sm font-medium">{text().scene.model}</h1>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_220px]">
        <section className="flex min-h-0 flex-col border-r border-border">
          <h2 className="px-4 pt-4 pb-2 text-xs font-medium text-muted-foreground">{text().scene.model}</h2>
          <form role="search" onSubmit={(event) => event.preventDefault()} className="px-3 pb-2">
            <input type="search" aria-label={text().models.search} placeholder={text().models.filter} value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring" />
          </form>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {shown.map((model) => <form key={model.value} onSubmit={(event) => { event.preventDefault(); sendToScene({ kind: 'model', model: model.value }) }}>
              <button type="submit" aria-label={model.label} aria-pressed={selectedModel === model.value} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${selectedModel === model.value ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
                <span><span className="block">{model.label}</span><span className="font-mono text-[10px] text-muted-foreground">{model.value}</span></span>
                {selectedModel === model.value && <span aria-hidden="true">✓</span>}
              </button>
            </form>)}
            {shown.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">{models.length ? text().models.noMatches : text().models.empty}</p>}
          </div>
        </section>
        <section className="flex min-h-0 flex-col">
          <h2 className="px-4 pt-4 pb-2 text-xs font-medium text-muted-foreground">{text().scene.effort}</h2>
          <div className="p-2">{efforts.map((effort) => <form key={effort} onSubmit={(event) => { event.preventDefault(); sendToScene({ kind: 'effort', effort }) }}>
            <button type="submit" aria-pressed={settings.effort === effort} className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm capitalize ${settings.effort === effort ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
              {effort}{settings.effort === effort && <span aria-hidden="true">✓</span>}
            </button>
          </form>)}</div>
          <p className="mt-auto border-t border-border px-4 py-3 text-xs text-muted-foreground">{settings.model ? models.find((model) => model.value === settings.model)?.label ?? settings.model : text().models.default} · {settings.effort}</p>
        </section>
      </div>
    </main>
  )
}
