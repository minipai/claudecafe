import { useState } from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

type InputBarProps = {
  isDisabled: boolean
  isBusy: boolean
  onSubmit: (text: string) => void
  onStop: () => void
}

export function InputBar({ isDisabled, isBusy, onSubmit, onStop }: InputBarProps) {
  const [text, setText] = useState('')

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (isDisabled || !text.trim()) return
        onSubmit(text)
        setText('')
      }}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            e.currentTarget.form?.requestSubmit()
          }
        }}
        placeholder="Type a message… Kotone will choose how to respond."
        disabled={isDisabled}
        className="min-h-8 resize-none border-none bg-transparent shadow-none focus-visible:ring-0"
      />
      {isBusy ? (
        <Button type="button" size="icon-sm" aria-label="Stop" onClick={onStop}>
          <Square fill="currentColor" className="size-2.5" />
        </Button>
      ) : (
        <Button type="submit" size="icon-sm" disabled={isDisabled || !text.trim()} aria-label="Send">
          <ArrowUp />
        </Button>
      )}
    </form>
  )
}
