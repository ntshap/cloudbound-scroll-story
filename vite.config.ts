import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Media lives in public/assets and is copied verbatim into dist/public/assets,
// where server.mjs serves it. Nothing is fetched from managed storage at dev or
// build time, so a checkout is self-contained.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist/public' },
  server: { allowedHosts: true },
})
