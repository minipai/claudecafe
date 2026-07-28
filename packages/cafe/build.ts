// Build step (dev-time, run with bun): vendor the cast into ./vendor so the
// plugin is self-contained when copied to the marketplace cache. Resolves the
// `@claudecafe/maid-personas` package (a devDependency) — no relative
// ../maid-personas path.
// The runtime hook stays pure bash; this only generates committed-or-ignored data.
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readdirSync, copyFileSync, mkdirSync, rmSync } from 'node:fs'

const require = createRequire(import.meta.url)
const castDir = dirname(require.resolve('@claudecafe/maid-personas/package.json'))
const outDir = join(import.meta.dirname, 'vendor')

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

const personas = readdirSync(castDir).filter((f) => f.endsWith('.md'))
for (const f of personas) copyFileSync(join(castDir, f), join(outDir, f))

console.log(`vendored ${personas.length} personas from @claudecafe/maid-personas -> vendor/`)
