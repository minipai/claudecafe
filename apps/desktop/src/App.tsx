import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { castList, type CastMember } from '@/agent'
import { text } from '@/i18n'
import { GalgameClient } from './galgame/GalgameClient'

export function App() {
  const [cast, setCast] = useState<CastMember[] | null>(null)
  const [error, setError] = useState('')
  const t = text().shift
  const hasCast = Boolean(cast?.length)

  useEffect(() => {
    void castList().then(setCast).catch((reason: unknown) => {
      setError(String(reason))
      setCast([])
    })
  }, [])

  useEffect(() => {
    if (hasCast && window.cafe?.characterInstallError) {
      toast.error(window.cafe.characterInstallError, { id: 'character-install-error' })
    }
  }, [hasCast])

  async function refreshCharacters() {
    try {
      setCast(await castList())
      setError('')
    } catch (reason) {
      setError(String(reason))
    }
  }

  if (cast?.length) {
    return <GalgameClient cast={cast} directory={window.cafe?.charactersDir ?? ''} onRefreshCharacters={refreshCharacters} />
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-3 rounded-xl bg-card p-6 text-card-foreground shadow-xl">
        <h1 className="text-lg font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{cast === null ? t.loading : t.empty}</p>
        {window.cafe?.charactersDir && <p className="break-all text-xs text-muted-foreground">{window.cafe.charactersDir}</p>}
        {window.cafe?.characterInstallError && <p role="alert" className="whitespace-pre-line text-sm text-destructive">{window.cafe.characterInstallError}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </main>
  )
}
