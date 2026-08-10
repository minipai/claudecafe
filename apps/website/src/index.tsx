import { Hono } from "hono";
import type { Context } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getCookie, setCookie } from "hono/cookie";
import { Layout } from "./components/Layout.js";
import { HomePage } from "./components/HomePage.js";
import { MaidPage } from "./pages/MaidPage.js";

import { NotFoundPage, notFoundQuote } from "./pages/NotFoundPage.js";
import { getAllMaids, getMaid } from "./utils/maids.js";
import { BlogPostPage } from "./pages/BlogPostPage.js";
import { BlogIndexPage } from "./pages/BlogIndexPage.js";
import { getAllPosts, getPost } from "./utils/blog.js";
import { href, ui, type Locale } from "./i18n.js";

const app = new Hono();

function render404(c: Context, locale: Locale) {
  const pick = notFoundQuote(locale);
  return c.html(
    <Layout locale={locale} maid={pick.slug}>
      <NotFoundPage pick={pick} locale={locale} />
    </Layout>,
    404,
  );
}

app.use("*", async (c, next) => {
  await next();
  if (!c.res.headers.has("Cache-Control")) {
    c.header("Cache-Control", "public, max-age=1800");
  }
});

// Language preference: ?lang= (the switcher) pins a cookie and redirects to
// the clean URL; the cookie only ever reroutes the bare root, so deep links
// always show the language their URL says. Crawlers carry neither.
app.use("*", async (c, next) => {
  const lang = c.req.query("lang");
  if (lang === "en" || lang === "zh") {
    setCookie(c, "lang", lang, { path: "/", maxAge: 31536000, sameSite: "Lax" });
    c.header("Cache-Control", "no-store");
    return c.redirect(c.req.path);
  }
  if (c.req.path === "/" && getCookie(c, "lang") === "zh") {
    c.header("Cache-Control", "no-store");
    return c.redirect("/zh");
  }
  await next();
});

app.use("/assets/*", serveStatic({ root: "./src/" }));
app.use("/downloads/*", serveStatic({ root: "./src/" }));

app.get("/robots.txt", (c) => {
  return c.text("User-agent: *\nAllow: /\n");
});

// The same site, once per language: English at the root, Chinese under /zh.
function site(locale: Locale) {
  const page = new Hono();

  page.get("/", (c) => {
    const accept = c.req.header("Accept") || "";
    const maids = getAllMaids(locale);
    const posts = getAllPosts(locale);

    if (accept.includes("text/markdown")) {
      const index = maids
        .map((m) => `- [${m.jaName} (${m.enName})](${href(locale, `/${m.slug}`)}) — ${m.title}`)
        .join("\n");
      const md = `# The Claude Café\n\n${ui[locale].mdIndexLead}\n\n${index}\n`;
      return c.text(md, 200, { "Content-Type": "text/markdown; charset=utf-8" });
    }

    return c.html(
      <Layout locale={locale}>
        <HomePage maids={maids} posts={posts} locale={locale} />
      </Layout>,
    );
  });

  page.get("/notes", (c) => {
    const posts = getAllPosts(locale);
    return c.html(
      <Layout locale={locale} title="Blog" description="The Claude Café Blog" path="/notes">
        <BlogIndexPage posts={posts} locale={locale} />
      </Layout>,
    );
  });

  page.get("/notes/:slug", (c) => {
    const post = getPost(c.req.param("slug"), locale);
    if (!post) return render404(c, locale);
    return c.html(
      <Layout locale={locale} title={post.title} description={post.title} path={`/notes/${post.slug}`} maid={post.author}>
        <BlogPostPage post={post} />
      </Layout>,
    );
  });

  page.get("/:name", (c) => {
    const accept = c.req.header("Accept") || "";
    const name = c.req.param("name");

    // /<slug>.md is the persona file itself, frontmatter included — the
    // download link on her page, and what an agent hires her with.
    if (name.endsWith(".md")) {
      const maid = getMaid(name.slice(0, -3), locale);
      if (!maid) return render404(c, locale);
      return c.text(maid.sourceMd, 200, {
        "Content-Type": "text/markdown; charset=utf-8",
      });
    }

    const maid = getMaid(name, locale);
    if (!maid) return render404(c, locale);

    if (accept.includes("text/markdown") || accept.includes("text/plain")) {
      return c.text(maid.rawMd, 200, {
        "Content-Type": "text/markdown; charset=utf-8",
      });
    }

    return c.html(
      <Layout locale={locale} title={`${maid.jaName} (${maid.enName})`} description={`${maid.title}「${maid.quote}」`} path={`/${maid.slug}`} maid={maid.slug}>
        <MaidPage maid={maid} locale={locale} />
      </Layout>,
    );
  });

  return page;
}

app.route("/zh", site("zh"));
app.route("/", site("en"));

app.notFound((c) => {
  const locale: Locale = c.req.path === "/zh" || c.req.path.startsWith("/zh/") ? "zh" : "en";
  return render404(c, locale);
});

const port = 5050;
console.log(`☕ The Claude Café is serving at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
