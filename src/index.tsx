import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Layout } from "./components/Layout.js";
import { HomePage } from "./components/HomePage.js";
import { MaidPage } from "./pages/MaidPage.js";

import { NotFoundPage } from "./pages/NotFoundPage.js";
import { getAllMaids, getMaid } from "./utils/maids.js";
import { BlogPostPage } from "./pages/BlogPostPage.js";
import { BlogIndexPage } from "./pages/BlogIndexPage.js";
import { getAllPosts, getPost } from "./utils/blog.js";

const app = new Hono();

app.use("*", async (c, next) => {
  await next();
  if (!c.res.headers.has("Cache-Control")) {
    c.header("Cache-Control", "public, max-age=1800");
  }
});
app.use("/assets/*", serveStatic({ root: "./src/" }));
app.use("/downloads/*", serveStatic({ root: "./src/" }));

app.get("/robots.txt", (c) => {
  return c.text("User-agent: *\nAllow: /\n");
});

app.get("/", (c) => {
  const accept = c.req.header("Accept") || "";
  const maids = getAllMaids();
  const posts = getAllPosts();

  if (accept.includes("text/markdown")) {
    const index = maids
      .map((m) => `- [${m.jaName} (${m.enName})](/${m.slug}) — ${m.title}`)
      .join("\n");
    const md = `# The Claude Café\n\n六位女僕，一座咖啡廳。\n\n${index}\n`;
    return c.text(md, 200, { "Content-Type": "text/markdown; charset=utf-8" });
  }

  return c.html(
    <Layout>
      <HomePage maids={maids} posts={posts} />
    </Layout>,
  );
});


app.get("/notes", (c) => {
  const posts = getAllPosts();
  return c.html(
    <Layout title="Blog" description="The Claude Café Blog" path="/notes">
      <BlogIndexPage posts={posts} />
    </Layout>,
  );
});

app.get("/notes/:slug", (c) => {
  const post = getPost(c.req.param("slug"));
  if (!post) {
    return c.html(
      <Layout>
        <NotFoundPage />
      </Layout>,
      404,
    );
  }
  return c.html(
    <Layout title={post.title} description={post.title} path={`/notes/${post.slug}`}>
      <BlogPostPage post={post} />
    </Layout>,
  );
});

app.get("/:name", (c) => {
  const accept = c.req.header("Accept") || "";
  const maid = getMaid(c.req.param("name"));

  if (!maid) {
    return c.html(
      <Layout>
        <NotFoundPage />
      </Layout>,
      404,
    );
  }

  if (accept.includes("text/markdown") || accept.includes("text/plain")) {
    return c.text(maid.rawMd, 200, {
      "Content-Type": "text/markdown; charset=utf-8",
    });
  }

  return c.html(
    <Layout title={`${maid.jaName} (${maid.enName})`} description={`${maid.title}「${maid.quote}」`} path={`/${c.req.param("name")}`}>
      <MaidPage maid={maid} />
    </Layout>,
  );
});

app.notFound((c) => {
  return c.html(
    <Layout>
      <NotFoundPage />
    </Layout>,
    404,
  );
});

const port = 5050;
console.log(`☕ The Claude Café is serving at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
