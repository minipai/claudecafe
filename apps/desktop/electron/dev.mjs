import { spawn } from 'node:child_process'
import electronPath from 'electron'
import { createServer } from 'vite'
import { buildElectron } from './build.mjs'

/**
 * Dev run: Vite serves the window, Electron loads it from there. Pass a folder
 * to open the maid on it — `pnpm app ~/Dev/something` — otherwise she works
 * where she was started.
 */
const folder = process.argv[2]

await buildElectron()

const server = await createServer()
await server.listen()
const url = server.resolvedUrls?.local?.[0]
if (!url) throw new Error('Vite did not report a local URL')

const args = ['.', ...(folder ? [`--dir=${folder}`] : [])]
const electron = spawn(electronPath, args, {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: url },
})

electron.on('close', async () => {
  await server.close()
  process.exit(0)
})
