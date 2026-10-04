import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { trimTrailingSlash } from "hono/trailing-slash";
import { Layout } from "./components/Layout.js";
import { HomePage } from "./components/HomePage.js";
import { MaidPage } from "./pages/MaidPage.js";

import { NotFoundPage, notFoundQuote } from "./pages/NotFoundPage.js";
import { getAllMaids, getMaid } from "./utils/maids.js";
import { href, ui, type Locale } from "./i18n.js";

const app = new Hono<{ Bindings: { PLUGINS: R2Bucket } }>();

function render404(c: Context, locale: Locale) {
  const pick = notFoundQuote(locale);
  return c.html(
    <Layout locale={locale}>
      <NotFoundPage pick={pick} locale={locale} />
    </Layout>,
    404,
  );
}

// /zh/ and friends: a trailing slash that would 404 redirects to the page.
app.use(trimTrailingSlash());

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

app.get("/robots.txt", (c) => {
  return c.text("User-agent: *\nAllow: /\n");
});

// The Claude Code plugin shelf: marketplace.json plus the versioned zips it
// points at, uploaded to R2 by scripts/ship-plugin.sh. A published zip never
// changes; the marketplace does with every release.
app.get("/plugins/:file", async (c) => {
  const file = c.req.param("file");
  const object = await c.env.PLUGINS.get(file);
  if (!object) return c.notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set(
    "Cache-Control",
    file.endsWith(".zip") ? "public, max-age=31536000, immutable" : "no-cache",
  );
  return new Response(object.body, { headers });
});

// The same site, once per language: English at the root, Chinese under /zh.
function site(locale: Locale) {
  const page = new Hono();

  page.get("/", (c) => {
    const accept = c.req.header("Accept") || "";
    const maids = getAllMaids(locale);

    if (accept.includes("text/markdown")) {
      const index = maids
        .map((m) => `- [${m.jaName} (${m.enName})](${href(locale, `/${m.slug}`)}) — ${m.title}`)
        .join("\n");
      const md = `# The Claude Café\n\n${ui[locale].mdIndexLead}\n\n${index}\n`;
      return c.text(md, 200, { "Content-Type": "text/markdown; charset=utf-8" });
    }

    return c.html(
      <Layout locale={locale}>
        <HomePage locale={locale} />
      </Layout>,
    );
  });

  // The plugin and desktop app pages folded into the homepage.
  for (const old of ["/plugin", "/app"]) {
    page.get(old, (c) => c.redirect(`${href(locale, "/")}#install`, 301));
  }

  page.get("/:name", (c) => {
    const accept = c.req.header("Accept") || "";
    const name = c.req.param("name");

    // /<slug>.md is the persona file itself, frontmatter included — the
    // catalog payload used by the page, pack tooling, and host sync.
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
      <Layout locale={locale} title={`${maid.jaName} (${maid.enName})`} description={`${maid.title}「${maid.quote}」`} path={`/${maid.slug}`}>
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

export default app;
