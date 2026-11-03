import { svelte } from "@sveltejs/vite-plugin-svelte"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

// The prototype runs on fake data only. When the real client is added, the
// dev server proxies /personal/* to a local Personal (see README.md), so the
// browser talks to one origin in development as it will on Vercel.
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
})
