import { getFramePath, type TransitionAsset } from '../data/assets'
import { fetchAssetWithRetry } from './assetLoading'

interface SequenceState {
  abortController: AbortController
  blobs: Map<number, Blob>
  decoded: Map<number, ImageBitmap>
  decodeRequests: Map<number, Promise<ImageBitmap>>
  loadRequest?: Promise<LoadResult>
  progressListeners: Set<(progress: number) => void>
}

export interface LoadResult {
  errors: number[]
  loaded: number
  total: number
}

const LOAD_CONCURRENCY = 6
const MAX_DECODED_FRAMES = 24

export class FrameSequenceStore {
  private readonly sequences = new Map<number, SequenceState>()

  constructor(private readonly manifest: readonly TransitionAsset[]) {}

  load(index: number, onProgress?: (progress: number) => void) {
    const asset = this.manifest[index]
    if (!asset) {
      return Promise.reject(new Error(`Unknown transition index: ${index}`))
    }

    const state = this.getState(index)
    if (state.blobs.size === asset.frameCount) {
      onProgress?.(1)
      return Promise.resolve({ loaded: state.blobs.size, total: asset.frameCount, errors: [] })
    }
    if (onProgress) {
      state.progressListeners.add(onProgress)
      onProgress(state.blobs.size / asset.frameCount)
    }
    if (state.loadRequest) {
      return state.loadRequest.finally(() => {
        if (onProgress) state.progressListeners.delete(onProgress)
      })
    }

    const missingFrames: number[] = []
    for (let frame = asset.frameStart; frame < asset.frameStart + asset.frameCount; frame += 1) {
      if (!state.blobs.has(frame)) missingFrames.push(frame)
    }
    if (missingFrames.length === 0) {
      onProgress?.(1)
      return Promise.resolve({ loaded: state.blobs.size, total: asset.frameCount, errors: [] })
    }

    let cursor = 0
    const errors: number[] = []
    const reportProgress = () => {
      const progress = state.blobs.size / asset.frameCount
      for (const listener of state.progressListeners) listener(progress)
    }
    const worker = async () => {
      while (cursor < missingFrames.length) {
        const frame = missingFrames[cursor]
        cursor += 1
        try {
          const response = await fetchAssetWithRetry(getFramePath(asset, frame), {
            signal: state.abortController.signal,
          })
          state.blobs.set(frame, await response.blob())
        } catch (error) {
          if (!state.abortController.signal.aborted) {
            errors.push(frame)
            console.warn(`Unable to load transition frame ${frame}`, error)
          }
        } finally {
          reportProgress()
        }
      }
    }

    state.loadRequest = Promise.all(
      Array.from({ length: Math.min(LOAD_CONCURRENCY, missingFrames.length) }, worker),
    )
      .then(() => ({ loaded: state.blobs.size, total: asset.frameCount, errors }))
      .finally(() => {
        state.loadRequest = undefined
      })

    return state.loadRequest.finally(() => {
      if (onProgress) state.progressListeners.delete(onProgress)
    })
  }

  async decode(index: number, frame: number) {
    const state = this.getState(index)
    const cached = state.decoded.get(frame)
    if (cached) return cached

    const pending = state.decodeRequests.get(frame)
    if (pending) return pending

    const blob = state.blobs.get(frame)
    if (!blob) throw new Error(`Frame ${frame} is not loaded`)

    const request = createImageBitmap(blob)
      .then((bitmap) => {
        state.decoded.set(frame, bitmap)
        this.pruneDecoded(state, frame)
        return bitmap
      })
      .finally(() => state.decodeRequests.delete(frame))

    state.decodeRequests.set(frame, request)
    return request
  }

  async decodeWindow(index: number, frame: number, radius = 8) {
    const asset = this.manifest[index]
    if (!asset) return
    const first = asset.frameStart
    const last = first + asset.frameCount - 1
    const frames = new Set<number>()
    for (let offset = -radius; offset <= radius; offset += 1) {
      frames.add(Math.min(last, Math.max(first, frame + offset)))
    }
    await Promise.allSettled([...frames].map((candidate) => this.decode(index, candidate)))
  }

  prewarm(index: number, frame: number, radius = 6) {
    const asset = this.manifest[index]
    if (!asset) return
    const first = asset.frameStart
    const last = first + asset.frameCount - 1
    for (let offset = -radius; offset <= radius; offset += 1) {
      const nearbyFrame = Math.min(last, Math.max(first, frame + offset))
      void this.decode(index, nearbyFrame).catch(() => undefined)
    }
  }

  getDecoded(index: number, frame: number) {
    return this.sequences.get(index)?.decoded.get(frame)
  }

  nearestDecoded(index: number, frame: number) {
    const state = this.sequences.get(index)
    if (!state || state.decoded.size === 0) return undefined

    let nearest: ImageBitmap | undefined
    let distance = Number.POSITIVE_INFINITY
    for (const [candidateFrame, bitmap] of state.decoded) {
      const candidateDistance = Math.abs(candidateFrame - frame)
      if (candidateDistance < distance) {
        distance = candidateDistance
        nearest = bitmap
      }
    }
    return nearest
  }

  isLoaded(index: number) {
    const asset = this.manifest[index]
    return Boolean(asset && this.sequences.get(index)?.blobs.size === asset.frameCount)
  }

  releaseDistant(center: number, distance = 1) {
    for (const index of this.sequences.keys()) {
      if (Math.abs(index - center) > distance) this.release(index)
    }
  }

  release(index: number) {
    const state = this.sequences.get(index)
    if (!state) return
    state.abortController.abort()
    for (const bitmap of state.decoded.values()) bitmap.close()
    state.blobs.clear()
    state.decoded.clear()
    state.decodeRequests.clear()
    state.progressListeners.clear()
    this.sequences.delete(index)
  }

  dispose() {
    for (const index of [...this.sequences.keys()]) this.release(index)
  }

  private getState(index: number) {
    let state = this.sequences.get(index)
    if (!state) {
      state = {
        abortController: new AbortController(),
        blobs: new Map(),
        decoded: new Map(),
        decodeRequests: new Map(),
        progressListeners: new Set(),
      }
      this.sequences.set(index, state)
    }
    return state
  }

  private pruneDecoded(state: SequenceState, centerFrame: number) {
    if (state.decoded.size <= MAX_DECODED_FRAMES) return
    const byDistance = [...state.decoded.keys()].sort(
      (first, second) => Math.abs(second - centerFrame) - Math.abs(first - centerFrame),
    )
    while (state.decoded.size > MAX_DECODED_FRAMES) {
      const frame = byDistance.shift()
      if (frame === undefined) break
      state.decoded.get(frame)?.close()
      state.decoded.delete(frame)
    }
  }
}
