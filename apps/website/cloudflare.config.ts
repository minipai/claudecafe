import { bindings, defineConfig } from "cf/config";

// claudecafe.dev: Hono rendering pages in a Worker, with public/ served as
// static assets in front of it (see vite.config.ts for the build).
export default defineConfig({
  worker: {
    name: "claudecafe",
    compatibilityDate: "2026-09-01",
    entrypoint: "src/index.tsx",
    domains: ["claudecafe.dev"],
    env: {
      // The plugin shelf behind /plugins/*, filled by scripts/ship-plugin.sh.
      PLUGINS: bindings.r2({
        name: "claudecafe-plugins",
      }),
    },
  },
});
