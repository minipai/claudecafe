import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Question } from '@/agent'

type ChoiceRowProps = {
  question: Question
  onAnswer: (picks: string[]) => void
}

/**
 * The model's own question, laid out as the galgame choice branch it already
 * is. Single choice answers on the click; multiple choice holds the picks until
 * the master is done and confirms.
 */
export function ChoiceRow({ question, onAnswer }: ChoiceRowProps) {
  const [picks, setPicks] = useState<string[]>([])

  function toggle(label: string) {
    if (!question.multiSelect) {
      onAnswer([label])
      return
    }
    setPicks((current) =>
      current.includes(label) ? current.filter((pick) => pick !== label) : [...current, label],
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {question.options.map((option) => {
        const picked = picks.includes(option.label)
        return (
          <Button
            key={option.label}
            variant={picked ? 'default' : 'outline'}
            size="sm"
            title={option.description}
            onClick={() => toggle(option.label)}
          >
            {picked && <Check />}
            {option.label}
          </Button>
        )
      })}

      {question.multiSelect && (
        <Button variant="link" size="sm" className="h-auto p-0 text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => onAnswer(picks)}>
          {picks.length > 0 ? `這樣就好（${picks.length}）→` : '都不用 →'}
        </Button>
      )}
    </div>
  )
}
