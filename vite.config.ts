import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function managedAssets(mode: string): Plugin {
  const env = loadEnv(mode, '.', '')
  return {
    name: 'cloudbound-managed-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestPath = request.url?.split('?')[0]
        if (!requestPath?.startsWith('/assets/')) {
          next()
          return
        }

        const forgeUrl = (process.env.BUILT_IN_FORGE_API_URL || env.BUILT_IN_FORGE_API_URL)?.replace(/\/+$/, '')
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY || env.BUILT_IN_FORGE_API_KEY
        if (!forgeUrl || !forgeKey) {
          response.statusCode = 500
          response.end('Managed File Storage is unavailable')
          return
        }

        try {
          const presign = new URL('v1/storage/presign/get', `${forgeUrl}/`)
          presign.searchParams.set('path', requestPath.slice(1))
          const result = await fetch(presign, {
            headers: { Authorization: `Bearer ${forgeKey}` },
          })
          if (!result.ok) {
            response.statusCode = 502
            response.end('Unable to retrieve managed asset')
            return
          }
          const { url } = await result.json() as { url: string }
          response.statusCode = 307
          response.setHeader('Location', url)
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          response.end()
        } catch {
          response.statusCode = 502
          response.end('Unable to retrieve managed asset')
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [managedAssets(mode), react()],
  server: { allowedHosts: true },
}))
