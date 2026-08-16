import type { Lines } from '@/agent'

/**
 * What she says when the window is the one talking. English is written here
 * because the window has to open with something before anyone has signed in;
 * in any other language she writes them herself and the session hands them over
 * (see the main process's lines.ts).
 *
 * No line takes an argument. The command she is asking about, the file she wants
 * to change and the plan she wrote are all on the card beside her already —
 * wedging them into the sentence only makes the sentence untranslatable.
 */
export const ENGLISH_LINES: Lines = {
  greeting: 'Goshujin-sama~ what can I do for you today? Ask away, or press ⌘K to send me somewhere else ♪',
  interrupted: 'Eh, stopping there? O-okay…',
  commandAsk: 'Goshujin-sama, I would like to run this — may I?',
  editAsk: 'I would like to change this file~ have a look at what I am changing first?',
  planAsk: 'The plan is laid out! Does this look right to Goshujin-sama?',
  errorTitle: 'I tripped over something…',
  waiting: [
    'Just a moment more~ ♡',
    'I am looking through this…',
    'Mm — almost there ♪',
    'This function is being a little difficult…',
    'Nearly done, Goshujin-sama ♡',
  ],
}

let spoken: Lines = ENGLISH_LINES

/** Read at the moment of speaking, never kept: her wording can arrive a second
 * after the window opens, and whoever asks next should get the new one. */
export const lines = () => spoken

export function speakThese(written: Lines) {
  spoken = written
}
