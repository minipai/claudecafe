import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig, type Plugin } from "vite";

// The Worker is described in cloudflare.config.ts; this builds it. public/ is
// Vite's public directory, served as static assets in front of the Worker.
export default defineConfig({
  plugins: [cast(), cloudflare()],
  server: {
    host: true,
    port: 5050,
  },
});

/**
 * Parses the persona files into src/cast.json before each build, and again
 * whenever one changes while the dev server runs.
 */
function cast(): Plugin {
  const characters = fileURLToPath(new URL("../../packages/characters/", import.meta.url));
  const build = () => {
    execFileSync("tsx", ["scripts/build-cast.ts"], { stdio: "inherit" });
  };

  return {
    name: "cast",
    buildStart: build,
    configureServer(server) {
      server.watcher.add(characters);
      server.watcher.on("all", (_event, file) => {
        if (file.startsWith(characters) && /persona(\.\w+)?\.md$/.test(file)) build();
      });
    },
  };
}
