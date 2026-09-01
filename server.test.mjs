import { once } from 'node:events'
import { unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { serveFile } from './server.mjs'

class CaptureResponse extends Writable {
  chunks = []
  headers = {}
  statusCode = 0

  _write(chunk, _encoding, callback) {
    this.chunks.push(Buffer.from(chunk))
    callback()
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode
    this.headers = headers
    return this
  }
}

describe('serveFile byte ranges', () => {
  it('returns the requested bytes with HTTP 206 and a valid Content-Range', async () => {
    const file = path.join(tmpdir(), `cloudbound-range-${process.pid}.mp4`)
    await writeFile(file, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]))
    const response = new CaptureResponse()
    const finished = once(response, 'finish')

    try {
      await expect(
        serveFile(file, { method: 'GET', headers: { range: 'bytes=2-5' } }, response),
      ).resolves.toBe(true)
      await finished

      expect(response.statusCode).toBe(206)
      expect(response.headers['Content-Range']).toBe('bytes 2-5/10')
      expect(response.headers['Content-Length']).toBe(4)
      expect(Buffer.concat(response.chunks)).toEqual(Buffer.from([2, 3, 4, 5]))
    } finally {
      await unlink(file).catch(() => undefined)
    }
  })
})
