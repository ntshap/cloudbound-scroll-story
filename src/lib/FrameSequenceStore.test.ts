import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TransitionAsset } from '../data/assets'
import { fetchAssetWithRetry } from './assetLoading'
import { FrameSequenceStore } from './FrameSequenceStore'

vi.mock('./assetLoading', () => ({
  fetchAssetWithRetry: vi.fn(),
}))

const transition: TransitionAsset = {
  id: 'test-transition',
  directory: '/assets/transitions/test-transition',
  fallback: '/assets/transitions/test-transition/fallback.mp4',
  frameCount: 3,
  frameHeight: 1440,
  framePrefix: 'frame_',
  frameStart: 1,
  frameWidth: 2560,
  fromScene: 0,
  toScene: 1,
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('FrameSequenceStore repair loading', () => {
  it('re-queues only frames still missing when a sequence is loaded again', async () => {
    const fetchMock = vi.mocked(fetchAssetWithRetry)
    let request = 0
    fetchMock.mockImplementation(async () => {
      request += 1
      if (request === 1) throw new TypeError('Network changed')
      return new Response(`frame-${request}`, { status: 200 })
    })

    const store = new FrameSequenceStore([transition])
    const first = await store.load(0)
    expect(first).toEqual({ loaded: 2, total: 3, errors: [1] })

    const repaired = await store.load(0)
    expect(repaired).toEqual({ loaded: 3, total: 3, errors: [] })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      '/assets/transitions/test-transition/frame_000001.webp',
    )
  })
})
