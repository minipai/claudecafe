// The mood marker a maid ends every reply with can only ever name a face that
// exists as artwork, so this table is the whole vocabulary. character-viewer reads it
// from the prompt that defines it rather than keeping a copy: a new expression
// is vocabulary the day it lands there.
import fs from 'node:fs'
import path from 'node:path'

export function readExpressions(personaPanel) {
  const cues = path.join(personaPanel, 'prompts', 'cues.md')
  if (!fs.existsSync(cues)) return null
  const rows = fs.readFileSync(cues, 'utf8')
    .split(/\r?\n/)
    .map((line) => /^\|\s*([a-z]+)\s*\|\s*(.+?)\s*\|\s*$/.exec(line))
    .filter((row) => row && row[1] !== 'expression')
  return rows.length ? rows.map(([, expression, kaomoji]) => ({ expression, kaomoji })) : null
}
