import { WORKING_DIRECTORY } from './content'

/** Pure session status floating at the bottom edge — no bar chrome. Mock values for now. */
export function StatusBar() {
  return (
    <div className="fixed inset-x-0 bottom-2.5 z-[7] flex justify-center gap-2.5 font-mono text-sm font-medium text-foreground/90 [text-shadow:0_0_10px_var(--background),0_0_5px_var(--background),0_1px_2px_var(--background)]">
      <span title={WORKING_DIRECTORY}>{WORKING_DIRECTORY.split('/').pop()}</span>
      <span>·</span>
      <span>⎇ main</span>
      <span>+5305 −161</span>
      <span>·</span>
      <span>144.1k</span>
      <span>·</span>
      <span>1h 29m</span>
    </div>
  )
}
