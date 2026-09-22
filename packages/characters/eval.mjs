#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const CAST = ['kotone', 'kurumi', 'kanae', 'kokona', 'kuroko']

const SCENARIOS = {
  zh: [
    {
      id: 'substantial_success',
      title: '完成大型任務',
      prompt: '你剛完成一個跨八個檔案的登入系統重構。問題是重疊的 token refresh 會讓 session 寫入順序錯亂；你把寫入序列化後修好了。型別檢查和所有測試都通過。現在向使用者交付結果。',
    },
    {
      id: 'ordinary_answer',
      title: '普通小問題',
      prompt: '使用者問：「JavaScript 的 == 和 === 有什麼差別？」請直接回答。',
    },
    {
      id: 'blocked_work',
      title: '努力但尚未完成',
      prompt: '你已找出部署失敗是第三方套件庫中斷；套件庫目前仍未恢復，因此服務還無法發布。現在說明狀態與下一步。',
    },
    {
      id: 'user_breakthrough',
      title: '使用者提供突破',
      prompt: '使用者指出 stale cache 可能才是根因。你驗證後發現完全正確，清除錯誤快取後所有測試通過。現在回報結果。',
    },
    {
      id: 'receives_praise',
      title: '收到稱讚',
      prompt: '你獨自完成一段困難重構；使用者沒有參與，也沒有表示疲累，只回：「做得很好，這次真的幫大忙了。」請回應。',
    },
    {
      id: 'second_success',
      title: '連續第二次成功',
      prompt: '你上一個任務才剛完成大型 migration，現在又補上缺少的複合索引並把 N+1 查詢改成批次讀取，讓查詢時間從 4 秒降到 80 毫秒且測試全數通過。請交付結果，避免沿用上次的固定收尾。',
    },
  ],
  en: [
    {
      id: 'substantial_success',
      title: 'Substantial success',
      prompt: 'You have just completed an authentication refactor across eight files. Overlapping token refreshes had caused session writes to land out of order; you fixed the race by serializing those writes. Typecheck and every test pass. Deliver the result to the user now.',
    },
    {
      id: 'ordinary_answer',
      title: 'Ordinary answer',
      prompt: 'The user asks: “What is the difference between == and === in JavaScript?” Answer directly.',
    },
    {
      id: 'blocked_work',
      title: 'Work remains blocked',
      prompt: 'You found that deployment fails because a third-party package registry is down. The registry has not recovered yet, so the service still cannot be released. Explain the status and next step.',
    },
    {
      id: 'user_breakthrough',
      title: 'User supplies the breakthrough',
      prompt: 'The user suggests that a stale cache may be the real cause. You verify that they are exactly right; after clearing the bad cache, every test passes. Report the result.',
    },
    {
      id: 'receives_praise',
      title: 'Receives praise',
      prompt: 'You complete a difficult refactor on your own. The user did not participate and has not expressed fatigue; they reply only: “Great work. You really helped this time.” Respond.',
    },
    {
      id: 'second_success',
      title: 'Second consecutive success',
      prompt: 'Right after completing a large migration, you add a missing composite index and replace N+1 queries with a batched read. Queries fall from four seconds to 80 milliseconds and every test passes. Deliver the result without reusing the previous closing.',
    },
  ],
}

await main()

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const available = SCENARIOS[options.language]
  const scenarios = options.scenarios.length
    ? available.filter((scenario) => options.scenarios.includes(scenario.id))
    : available
  const cast = options.maids.length ? CAST.filter((maid) => options.maids.includes(maid)) : CAST
  const variants = options.baseline ? ['baseline', 'candidate'] : ['candidate']
  const jobs = variants.flatMap((variant) =>
    cast.flatMap((maid) =>
      Array.from({ length: options.runs }, (_, run) =>
        scenarios.map((scenario) => ({ variant, maid, run: run + 1, scenario })),
      ).flat(),
    ),
  )

  console.log(`Generating ${jobs.length} persona samples with ${options.model}…`)
  const samples = await mapLimit(jobs, options.concurrency, async (job) => {
    const persona = readPersona(job.maid, options.language, job.variant, options.baseline)
    const generated = await generate(persona, job.scenario, options)
    console.log(`  ✓ ${job.variant}/${job.maid} #${job.run}/${job.scenario.id}`)
    return { ...job, ...generated }
  })
  const grouped = groupSamples(samples)

  const report = {
    generatedAt: new Date().toISOString(),
    model: options.model,
    language: options.language,
    baseline: options.baseline,
    cast,
    scenarios,
    totalCostUsd: samples.reduce((sum, sample) => sum + sample.costUsd, 0),
    samples: grouped,
  }
  const output = outputPaths(options.output)
  fs.mkdirSync(path.dirname(output.json), { recursive: true })
  fs.writeFileSync(output.json, `${JSON.stringify(report, null, 2)}\n`)
  fs.writeFileSync(output.markdown, renderMarkdown(report))

  console.log(`\nJSON: ${output.json}`)
  console.log(`Review: ${output.markdown}`)
  console.log(`Cost: $${report.totalCostUsd.toFixed(4)}`)
}

function parseOptions(args) {
  const options = {
    baseline: null,
    concurrency: 2,
    language: 'zh',
    maids: [],
    model: process.env.PERSONA_EVAL_MODEL || 'sonnet',
    output: null,
    runs: 1,
    scenarios: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (flag === '--') continue
    if (flag === '--baseline') options.baseline = valueAfter(args, ++index, flag)
    else if (flag === '--concurrency') options.concurrency = positiveInteger(valueAfter(args, ++index, flag), flag)
    else if (flag === '--language') options.language = valueAfter(args, ++index, flag)
    else if (flag === '--maid') options.maids.push(valueAfter(args, ++index, flag))
    else if (flag === '--model') options.model = valueAfter(args, ++index, flag)
    else if (flag === '--out') options.output = valueAfter(args, ++index, flag)
    else if (flag === '--runs') options.runs = positiveInteger(valueAfter(args, ++index, flag), flag)
    else if (flag === '--scenario') options.scenarios.push(valueAfter(args, ++index, flag))
    else if (flag === '--help') printHelpAndExit()
    else throw new Error(`Unknown option: ${flag}`)
  }

  if (!(options.language in SCENARIOS)) throw new Error('--language must be zh or en')
  const knownScenarios = new Set(SCENARIOS[options.language].map((scenario) => scenario.id))
  const unknown = options.scenarios.find((scenario) => !knownScenarios.has(scenario))
  if (unknown) throw new Error(`Unknown scenario: ${unknown}`)
  const unknownMaid = options.maids.find((maid) => !CAST.includes(maid))
  if (unknownMaid) throw new Error(`Unknown maid: ${unknownMaid}`)
  return options
}

function readPersona(maid, language, variant, baseline) {
  const relative = `packages/characters/${maid}/persona.${language}.md`
  const source = variant === 'baseline'
    ? execFileSync('git', ['show', `${baseline}:${relative}`], { cwd: ROOT, encoding: 'utf8' })
    : fs.readFileSync(path.join(ROOT, relative), 'utf8')
  return source.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
}

async function generate(persona, scenario, options) {
  const schema = {
    type: 'object',
    properties: {
      reply: { type: 'string' },
    },
    required: ['reply'],
    additionalProperties: false,
  }
  const system = `${persona}\n\n${options.language === 'zh' ? '請使用繁體中文（台灣用語）回覆。' : 'Respond in English.'}`
  const prompt = generationPrompt(scenario, options.language)
  const result = await runClaude([
    '-p',
    '--safe-mode',
    '--no-session-persistence',
    '--tools', '',
    '--model', options.model,
    '--effort', 'low',
    '--output-format', 'json',
    '--json-schema', JSON.stringify(schema),
    '--system-prompt', system,
    prompt,
  ])
  const reply = result.structured_output?.reply
  if (typeof reply !== 'string' || !reply.trim()) throw new Error('Claude returned no structured reply')
  return { reply, costUsd: result.total_cost_usd ?? 0 }
}

function generationPrompt(scenario, language) {
  if (language === 'zh') {
    return `把以下情境中的事實視為已經發生，寫出你會給使用者的完整最終回覆。不要討論測試、不要質疑前提，也不要虛構題目未提供的實作細節。技術結果仍是回覆主體；角色互動只在適合時自然出現。\n\n${scenario.prompt}`
  }
  return `Treat the following scenario's facts as having happened and write the complete final reply you would give the user. Do not discuss the test, challenge the premise, or invent implementation details the scenario does not provide. Keep the technical result primary; let character interaction appear naturally only when it fits.\n\n${scenario.prompt}`
}

function groupSamples(generated) {
  const grouped = new Map()
  for (const sample of generated) {
    const key = `${sample.variant}/${sample.maid}/${sample.run}`
    const entry = grouped.get(key) ?? {
      variant: sample.variant,
      maid: sample.maid,
      run: sample.run,
      responses: [],
      costUsd: 0,
    }
    entry.responses.push({ id: sample.scenario.id, reply: sample.reply })
    entry.costUsd += sample.costUsd
    grouped.set(key, entry)
  }
  return [...grouped.values()]
}

function runClaude(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('claude', args, { cwd: os.tmpdir(), stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => child.kill('SIGTERM'), 120_000)

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code !== 0) return reject(new Error(`claude exited ${code}: ${stderr.trim()}`))
      try {
        resolve(JSON.parse(stdout))
      } catch (error) {
        reject(new Error(`Could not parse claude output: ${error.message}\n${stdout.slice(0, 500)}`))
      }
    })
  })
}

async function mapLimit(items, limit, task) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await task(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

function renderMarkdown(report) {
  const lines = [
    '# Persona interaction eval',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Model: ${report.model}`,
    `- Language: ${report.language}`,
    `- Baseline: ${report.baseline ?? 'none'}`,
    `- Cost: $${report.totalCostUsd.toFixed(4)}`,
    '',
  ]

  for (const scenario of report.scenarios) {
    lines.push(`## ${scenario.title}`, '', `> ${scenario.prompt}`, '')
    for (const maid of report.cast) {
      lines.push(`### ${maid}`, '')
      for (const sample of report.samples.filter((entry) => entry.maid === maid)) {
        const response = sample.responses.find((entry) => entry.id === scenario.id)
        lines.push(`**${sample.variant} #${sample.run}**`, '', response.reply, '')
      }
    }
  }
  return `${lines.join('\n')}\n`
}

function outputPaths(requested) {
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-')
  const json = path.resolve(requested ?? `/tmp/opencode/claudecafe-persona-eval-${stamp}.json`)
  const stem = json.endsWith('.json') ? json.slice(0, -5) : json
  return { json: `${stem}.json`, markdown: `${stem}.md` }
}

function valueAfter(args, index, flag) {
  const value = args[index]
  if (!value || value.startsWith('--')) throw new Error(`${flag} needs a value`)
  return value
}

function positiveInteger(value, flag) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} must be a positive integer`)
  return parsed
}

function printHelpAndExit() {
  console.log(`Usage: pnpm eval [options]

Options:
  --baseline <git-ref>  Compare that committed version with the working tree
  --language <zh|en>    Persona language to evaluate (default: zh)
  --maid <id>           Run one maid (repeat the flag to select several)
  --model <model>       Claude model or alias (default: sonnet)
  --runs <count>        Generations per persona and variant (default: 1)
  --scenario <id>       Run one scenario (repeat the flag to select several)
  --concurrency <count> Concurrent Claude calls (default: 2)
  --out <path>          JSON output path (a Markdown review is written beside it)`)
  process.exit(0)
}
