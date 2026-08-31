import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')
const port = Number(process.env.PORT || 3000)
const forgeUrl = process.env.BUILT_IN_FORGE_API_URL?.replace(/\/+$/, '')
const forgeKey = process.env.BUILT_IN_FORGE_API_KEY
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])

async function serveManagedVideo(request, requestPath, response) {
  if (!forgeUrl || !forgeKey) {
    response.writeHead(500).end('Managed File Storage is unavailable')
    return
  }

  const presign = new URL('v1/storage/presign/get', `${forgeUrl}/`)
  presign.searchParams.set('path', requestPath.slice(1))
  const result = await fetch(presign, {
    headers: { Authorization: `Bearer ${forgeKey}` },
  })
  if (!result.ok) {
    response.writeHead(502).end('Unable to retrieve managed video')
    return
  }

  const { url } = await result.json()
  const range = request.headers.range
  const upstream = await fetch(url, {
    method: request.method === 'HEAD' ? 'HEAD' : 'GET',
    headers: range ? { Range: range } : undefined,
  })
  if (!upstream.ok && upstream.status !== 206) {
    response.writeHead(upstream.status).end('Unable to retrieve managed video')
    return
  }

  const headers = {
    'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
  }
  const contentLength = upstream.headers.get('content-length')
  const contentRange = upstream.headers.get('content-range')
  const etag = upstream.headers.get('etag')
  if (contentLength) headers['Content-Length'] = contentLength
  if (contentRange) headers['Content-Range'] = contentRange
  if (etag) headers.ETag = etag

  response.writeHead(upstream.status, headers)
  if (request.method === 'HEAD' || !upstream.body) {
    response.end()
    return
  }
  Readable.fromWeb(upstream.body).pipe(response)
}

async function serveFile(absolute, request, response) {
  try {
    const info = await stat(absolute)
    if (!info.isFile()) return false
    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Type': mime.get(path.extname(absolute)) || 'application/octet-stream',
      'Cache-Control': absolute.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    }
    const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/)
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]))
      const requestedEnd = range[2] ? Number(range[2]) : info.size - 1
      const end = Math.min(info.size - 1, requestedEnd)
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end) {
        response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end()
        return true
      }
      headers['Content-Length'] = end - start + 1
      headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`
      response.writeHead(206, headers)
      if (request.method === 'HEAD') response.end()
      else createReadStream(absolute, { start, end }).pipe(response)
      return true
    }

    headers['Content-Length'] = info.size
    response.writeHead(200, headers)
    if (request.method === 'HEAD') response.end()
    else createReadStream(absolute).pipe(response)
    return true
  } catch {
    return false
  }
}

createServer(async (request, response) => {
  try {
    const requestPath = new URL(request.url || '/', 'http://localhost').pathname
    if (requestPath.startsWith('/assets/') && requestPath.endsWith('.mp4')) {
      await serveManagedVideo(request, requestPath, response)
      return
    }
    const relative = decodeURIComponent(requestPath).replace(/^\/+/, '')
    const candidate = path.resolve(root, relative || 'index.html')
    if (!candidate.startsWith(root)) {
      response.writeHead(400).end('Invalid path')
      return
    }
    if (await serveFile(candidate, request, response)) return
    await serveFile(path.join(root, 'index.html'), request, response)
  } catch (error) {
    console.error(error)
    response.writeHead(500).end('Internal server error')
  }
}).listen(port, () => {
  console.log(`Cloudbound server listening on port ${port}`)
})
