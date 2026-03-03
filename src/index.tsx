import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Layout } from './components/Layout.js'
import { HomePage } from './components/HomePage.js'
import { RolePage } from './pages/RolePage.js'
import { getAllRoles, getRole } from './utils/roles.js'

const app = new Hono()

app.use('/public/*', serveStatic({ root: './' }))

app.get('/', (c) => {
  const accept = c.req.header('Accept') || ''
  const roles = getAllRoles()

  if (accept.includes('text/markdown')) {
    const index = roles
      .map(r => `- [${r.jaName} (${r.enName})](/roles/${r.slug}) — ${r.title}`)
      .join('\n')
    const md = `# The Claude Café\n\n六位女僕，一座咖啡廳。\n\n${index}\n`
    return c.text(md, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
  }

  return c.html(
    <Layout>
      <HomePage roles={roles} />
    </Layout>
  )
})

app.get('/roles/:name', (c) => {
  const accept = c.req.header('Accept') || ''
  const role = getRole(c.req.param('name'))

  if (!role) {
    return c.text('404 — この子はまだ café にいないようです', 404)
  }

  if (accept.includes('text/markdown') || accept.includes('text/plain')) {
    return c.text(role.rawMd, 200, { 'Content-Type': 'text/markdown; charset=utf-8' })
  }

  return c.html(
    <Layout title={`${role.jaName} (${role.enName})`} showBack>
      <RolePage role={role} />
    </Layout>
  )
})

const port = 3000
console.log(`☕ The Claude Café is serving at http://localhost:${port}`)
serve({ fetch: app.fetch, port })
