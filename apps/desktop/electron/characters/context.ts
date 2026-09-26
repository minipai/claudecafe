import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { readContext, type ContextHost } from '@claudecafe/character-core'
import type { HookCallback } from '@anthropic-ai/claude-agent-sdk'
import { cafeRoot } from './cafehome'
import { replyLanguage } from './lines'

const exec = promisify(execFile)
const prompts = path.join(path.dirname(fileURLToPath(import.meta.url)), 'prompts')

/** Each SDK connection gets the same context as the plugin, with the
 * desktop's selected language and no second character selection or panel. */
export function contextHook(): HookCallback {
  const startedAt = Date.now()
  let greeted = false
  return async (input) => {
    if (input.hook_event_name !== 'UserPromptSubmit') return {}
    const greet = !greeted
    greeted = true
    const additionalContext = await readContext(host, {
      cwd: input.cwd,
      language: replyLanguage(),
      startedAt,
      greet,
    })
    return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext } }
  }
}

const host: ContextHost = {
  now: Date.now,
  config: async () => {
    try {
      const config = JSON.parse(await fs.readFile(path.join(cafeRoot(), 'config.json'), 'utf8'))
      return config && typeof config === 'object' && !Array.isArray(config) ? config : {}
    } catch {
      return {}
    }
  },
  readPrompt: (name) => fs.readFile(path.join(prompts, `${name}.md`), 'utf8'),
  readFile: (file) => fs.readFile(file, 'utf8'),
  home: async () => os.homedir(),
  weather: weatherLine,
  commitsToday: async (cwd) => {
    try {
      const { stdout } = await exec('git', ['-C', cwd, 'log', '--oneline', '--since=midnight'], { timeout: 3000 })
      return stdout.split('\n').filter(Boolean).length
    } catch {
      return 0
    }
  },
}

async function weatherLine() {
  const format = '%l｜%c%t (feels %f)｜sunrise %S, sunset %s'
  try {
    const response = await fetch(`https://wttr.in/?format=${encodeURIComponent(format)}`, {
      headers: { 'User-Agent': 'curl/8' },
      signal: AbortSignal.timeout(2000),
    })
    if (!response.ok) return null
    const text = (await response.text()).trim()
    if (!text || text.includes('\n')) return null
    return text.replace(/(\d\d:\d\d):\d\d/g, '$1')
  } catch {
    return null
  }
}
