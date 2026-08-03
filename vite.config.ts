import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so Capacitor iOS/Android can load JS/CSS from the bundle.
  base: './',
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // expose on LAN so you can open from a phone on the same Wi‑Fi
    watch: {
      // Native fs-event watching (chokidar) unreliably misses changes written
      // by the agent's file-editing tools in this sandboxed dev environment —
      // edits land on disk but HMR/dev-server transform cache never
      // invalidates. Polling reads mtimes directly, which is slower but
      // actually catches every edit.
      usePolling: true,
      interval: 300,
    },
  },
})
