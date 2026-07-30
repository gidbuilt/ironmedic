import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Relative base (`./`) when building for Supabase Storage hosting so asset
// URLs resolve under .../object/public/website/index.html on any project ref.
const deployTarget = process.env.VITE_DEPLOY_TARGET
const base = deployTarget === 'supabase-storage' ? './' : '/'

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Speech SDK ships as CJS/UMD; pre-bundle so Vite serves it cleanly.
    include: ['microsoft-cognitiveservices-speech-sdk'],
  },
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
