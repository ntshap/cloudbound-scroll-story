import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRetryUrl, fetchAssetWithRetry } from './assetLoading'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('asset loading retries', () => {
  it('preserves the original path and adds a retry cache buster only after failure', () => {
    expect(buildRetryUrl('/assets/stills/03-workshop.png', 0)).toBe(
      '/assets/stills/03-workshop.png',
    )
    expect(buildRetryUrl('/assets/stills/03-workshop.png', 2)).toBe(
      '/assets/stills/03-workshop.png?__cloudbound_retry=2',
    )
  })

  it('retries a transient failure and returns the successful response', async () => {
    const transientError = new TypeError('Network changed')
    const success = new Response('frame', { status: 200 })
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce(success)

    await expect(fetchAssetWithRetry('/assets/frame.webp')).resolves.toBe(success)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/assets/frame.webp?__cloudbound_retry=1',
    )
  })
})
