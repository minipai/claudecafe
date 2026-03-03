import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Layout } from './components/Layout.js'
import { HomePage } from './components/HomePage.js'
import { RolePage } from './pages/RolePage.js'
import { getAllMaids, getMaid } from './utils/maids.js'

const app = new Hono()

app.use('/public/*', async (c, next) => {
  await next()
  c.header('Cache-Control', 'public, max-age=86400, immutable')
})
app.use('/public/*', serveStatic({ root: './' }))

app.get('/', (c) => {
  const accept = c.req.header('Accept') || ''
  const maids = getAllMaids()

  if (accept.includes('text/markdown')) {
    const index = maids
      .map(m => `- [${m.jaName} (${m.enName})](/${m.slug}) — ${m.title}`)
      .join('\n')
    const md = `# The Claude Café\n\n六位女僕，一座咖啡廳。\n\n${index}\n`
    return c.text(md, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
  }

  return c.html(
    <Layout>
      <HomePage maids={maids} />
    </Layout>
  )
})

app.get('/:name', (c) => {
  const accept = c.req.header('Accept') || ''
  const maid = getMaid(c.req.param('name'))

  if (!maid) {
    return c.text('404 — この子はまだ café にいないようです', 404)
  }

  if (accept.includes('text/markdown') || accept.includes('text/plain')) {
    return c.text(maid.rawMd, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
  }

  return c.html(
    <Layout title={`${maid.jaName} (${maid.enName})`} showBack>
      <RolePage maid={maid} />
    </Layout>
  )
})

const port = 3000
console.log(`☕ The Claude Café is serving at http://localhost:${port}`)
serve({ fetch: app.fetch, port })
