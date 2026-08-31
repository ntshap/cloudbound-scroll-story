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

  it('notifies a caller that joins an already-running sequence load', async () => {
    const fetchMock = vi.mocked(fetchAssetWithRetry)
    const resolvers = new Map<string, (response: Response) => void>()
    fetchMock.mockImplementation(
      async (source) =>
        new Promise<Response>((resolve) => {
          resolvers.set(String(source), resolve)
        }),
    )

    const store = new FrameSequenceStore([transition])
    const initialLoad = store.load(0)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))

    const progress: number[] = []
    const joinedLoad = store.load(0, (value) => progress.push(value))
    resolvers.get('/assets/transitions/test-transition/frame_000001.webp')?.(
      new Response('frame-1', { status: 200 }),
    )
    await vi.waitFor(() => expect(progress).toContain(1 / 3))
    resolvers.get('/assets/transitions/test-transition/frame_000002.webp')?.(
      new Response('frame-2', { status: 200 }),
    )
    resolvers.get('/assets/transitions/test-transition/frame_000003.webp')?.(
      new Response('frame-3', { status: 200 }),
    )

    await Promise.all([initialLoad, joinedLoad])
    expect(progress.at(-1)).toBe(1)
  })
})
