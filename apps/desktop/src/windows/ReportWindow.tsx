import { useEffect, useRef } from 'react'
import { marked } from 'marked'
import { text } from '@/i18n'
import type { Report } from '@/agent'

/**
 * The write-up she handed over, in a window to read it in beside her. A newer
 * one replaces it, and the window goes back to the top for it.
 */
export function ReportWindow({ report }: { report: Report | null }) {
  const scrollRef = useRef<HTMLElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [report?.body])

  return (
    <main ref={scrollRef} className="h-screen overflow-y-auto bg-card px-12 pt-10 pb-8 text-card-foreground">
      {report ? (
        <div
          className="report-md mx-auto max-w-[620px]"
          // Line breaks are kept: a slash command prints plain text whose lines
          // are the layout, and markdown would otherwise run them together.
          dangerouslySetInnerHTML={{ __html: marked.parse(report.body, { async: false, breaks: true }) }}
        />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">{text().report.none}</p>
      )}
    </main>
  )
}
