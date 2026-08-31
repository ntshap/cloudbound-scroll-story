import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function managedAssets(): Plugin {
  return {
    name: 'cloudbound-managed-assets',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestPath = request.url?.split('?')[0]
        if (!requestPath?.startsWith('/assets/')) {
          next()
          return
        }

        const forgeUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, '')
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY
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
          const range = request.headers.range
          const upstream = await fetch(url, {
            method: request.method === 'HEAD' ? 'HEAD' : 'GET',
            headers: range ? { Range: range } : undefined,
          })
          if (!upstream.ok && upstream.status !== 206) {
            response.statusCode = upstream.status
            response.end('Unable to retrieve managed asset')
            return
          }

          response.statusCode = upstream.status
          response.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes')
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream')
          const contentLength = upstream.headers.get('content-length')
          const contentRange = upstream.headers.get('content-range')
          if (contentLength) response.setHeader('Content-Length', contentLength)
          if (contentRange) response.setHeader('Content-Range', contentRange)
          if (request.method === 'HEAD' || !upstream.body) {
            response.end()
            return
          }
          response.end(Buffer.from(await upstream.arrayBuffer()))
        } catch {
          response.statusCode = 502
          response.end('Unable to retrieve managed asset')
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [managedAssets(), react()],
  build: { outDir: 'dist/public' },
  server: { allowedHosts: true },
})
