import { fillPrompt } from "./prompt.ts"

export type ContextHost = {
  now(): number | Promise<number>
  config(): Promise<{ ambient_context?: boolean; festivals?: boolean | string }>
  readPrompt(name: "greeting" | "cues"): Promise<string>
  readFile(path: string): Promise<string>
  home(): Promise<string | undefined>
  weather(): Promise<string | null>
  commitsToday(cwd: string): Promise<number>
}

const FESTIVALS: Record<string, string> = {
  "01-01": "New Year's Day",
  "02-14": "Valentine's Day",
  "03-03": "Hinamatsuri (Girls’ Day)",
  "03-14": "White Day",
  "07-07": "Tanabata",
  "10-31": "Halloween",
  "12-24": "Christmas Eve",
  "12-25": "Christmas",
  "12-31": "New Year's Eve",
}

export async function readContext(
  host: ContextHost,
  options: { cwd: string; language: string; startedAt: number; greet: boolean },
): Promise<string> {
  const [config, now] = await Promise.all([host.config(), host.now()])
  // The time, place and weather are ambient; the mood marker is how her face is read, so it stays.
  const ambient = config.ambient_context !== false
  const pieces: string[] = []
  if (options.greet && ambient) pieces.push(await readGreeting(host, now))
  if (options.greet) pieces.push(fillPrompt(await host.readPrompt("cues"), { lang: options.language || "your reply language" }))
  if (ambient) pieces.push(await readTimeLine(host, config, options, now))
  return pieces.join("\n\n")
}

async function readGreeting(host: ContextHost, now: number): Promise<string> {
  const date = new Date(now)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())} (${date.toLocaleDateString("en-US", { weekday: "long" })})`
  const greeting = fillPrompt(await host.readPrompt("greeting"), { time })
  const weather = await host.weather()
  return [greeting, weather && `Weather: ${weather}`].filter(Boolean).join("\n\n")
}

async function readTimeLine(
  host: ContextHost,
  config: { festivals?: boolean | string },
  options: { cwd: string; startedAt: number },
  now: number,
): Promise<string> {
  const segments = [`Current time: ${formatDate(new Date(now))}`]
  const elapsed = now - options.startedAt
  if (elapsed >= 600_000) {
    const minutes = Math.floor(elapsed / 60_000)
    const hours = Math.floor(minutes / 60)
    segments.push(hours ? `session ${hours}h${minutes % 60}m` : `session ${minutes}m`)
  }
  if (options.cwd) {
    const count = await host.commitsToday(options.cwd)
    if (count) segments.push(`${count} commits today`)
  }
  const festival = await readFestival(host, config.festivals, new Date(now))
  if (festival) segments.push(festival)
  return segments.join("｜")
}

async function readFestival(host: ContextHost, setting: boolean | string | undefined, date: Date): Promise<string> {
  if (setting === false) return ""
  let festivals = FESTIVALS
  if (typeof setting === "string" && setting.trim()) {
    try {
      const path = expandHome(setting.trim(), await host.home())
      festivals = JSON.parse(await host.readFile(path))
    } catch {
      return ""
    }
  }
  return festivals[`${pad(date.getMonth() + 1)}-${pad(date.getDate())}`] ?? ""
}

function formatDate(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())} (${days[date.getDay()]})`
}

function expandHome(path: string, home: string | undefined): string {
  if (path === "~") return home ?? path
  if (path.startsWith("~/") && home) return `${home}/${path.slice(2)}`
  return path
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}
