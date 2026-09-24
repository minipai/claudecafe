import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { Layout } from "./components/Layout.js";
import { HomePage } from "./components/HomePage.js";
import { MaidPage } from "./pages/MaidPage.js";
import { PluginPage } from "./pages/PluginPage.js";
import { AppPage } from "./pages/AppPage.js";

import { NotFoundPage, notFoundQuote } from "./pages/NotFoundPage.js";
import { getAllMaids, getMaid } from "./utils/maids.js";
import { href, ui, type Locale } from "./i18n.js";

const app = new Hono<{ Bindings: { PLUGINS: R2Bucket } }>();

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
        <HomePage maids={maids} locale={locale} />
      </Layout>,
    );
  });

  page.get("/app", (c) => {
    const title =
      locale === "zh" ? "ClaudeCafe——最可愛的 Claude Code" : "ClaudeCafe — the most adorable Claude Code";
    const description =
      locale === "zh"
        ? "同一個 Claude Code，跑在沒有邊框的視窗裡：一位女僕站在你的桌面上回話、動手前先問你、長答案給你一份報告。可以在頁面上直接試玩。"
        : "The same Claude Code, in a window with no frame: a maid on your desktop who answers in her own voice, asks before she touches anything, and writes a report when the answer is long. Try her on the page.";
    return c.html(
      <Layout locale={locale} title={title} description={description} path="/app">
        <AppPage locale={locale} />
      </Layout>,
    );
  });

  page.get("/plugin", (c) => {
    const title =
      locale === "zh" ? "cafe — Claude Code 的女僕咖啡廳 plugin" : "cafe — a maid café plugin for Claude Code";
    const description =
      locale === "zh"
        ? "打開終端機，聽見一聲「歡迎回來，ご主人様」。cafe 是 Claude Code plugin：每個 session 由值班女僕迎接你、報時、用心情收尾。"
        : "Open your terminal to a warm “Welcome back, ご主人様.” A Claude Code plugin that puts a maid on shift every session — greetings, timekeeping and mood sign-offs.";
    return c.html(
      <Layout locale={locale} title={title} description={description} path="/plugin">
        <PluginPage locale={locale} />
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

export default app;
