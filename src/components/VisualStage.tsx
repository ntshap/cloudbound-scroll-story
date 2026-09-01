import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  resolveMasterProgress,
  transitions,
  type TransitionAsset,
} from '../data/assets'
import { scenes } from '../data/scenes'
import {
  clearMediaRetry,
  preloadImageWithRetry,
  retryMediaElement,
} from '../lib/assetLoading'
import { FrameSequenceStore } from '../lib/FrameSequenceStore'
import { LoadingScreen } from './LoadingScreen'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const VISUAL_BLEND = 0.075
const TEXT_BLEND = 0.18

interface VisualStageProps {
  lightweight: boolean
  onActiveSceneChange: (index: number) => void
  trackRef: RefObject<HTMLElement | null>
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

function waitForVideo(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      resolve()
      return
    }
    const finish = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadeddata', finish)
      video.removeEventListener('error', finish)
      resolve()
    }
    const timeout = window.setTimeout(finish, 8000)
    video.addEventListener('loadeddata', finish, { once: true })
    video.addEventListener('error', finish, { once: true })
  })
}

export function VisualStage({
  lightweight,
  onActiveSceneChange,
  trackRef,
}: VisualStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fallbackRef = useRef<HTMLVideoElement>(null)
  const stillRefs = useRef<Array<HTMLImageElement | null>>([])
  const textRefs = useRef<HTMLElement[]>([])
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const activeScene = useRef(0)
  const activeTransition = useRef(-1)
  const canvasTransition = useRef(-1)
  const desiredProgress = useRef(0)
  const direction = useRef(1)
  const failedSequences = useRef(new Set<number>())
  const fallbackTransition = useRef(-1)
  const forceRedraw = useRef(true)
  const idleReady = useRef<boolean[]>(scenes.map(() => false))
  const idlePreparing = useRef<boolean[]>(scenes.map(() => false))
  const idleTokens = useRef<number[]>(scenes.map(() => 0))
  const lastFrame = useRef(-1)
  const lastProgress = useRef(-1)
  const needsRender = useRef(true)
  const preparedDirection = useRef('')
  const store = useMemo(() => new FrameSequenceStore(transitions), [])
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [ready, setReady] = useState(false)

  const markActiveScene = useCallback(
    (index: number) => {
      if (activeScene.current === index) return
      activeScene.current = index
      onActiveSceneChange(index)
    },
    [onActiveSceneChange],
  )

  const prepareIdle = useCallback((index: number, reset = false) => {
    const video = videoRefs.current[index]
    if (!video) return
    if (idlePreparing.current[index] || (idleReady.current[index] && !reset)) return
    const token = (idleTokens.current[index] ?? 0) + 1
    idleTokens.current[index] = token
    idleReady.current[index] = false
    idlePreparing.current[index] = true
    video.preload = 'auto'
    video.pause()

    const finish = () => {
      if (idleTokens.current[index] !== token) return
      idlePreparing.current[index] = false
      idleReady.current[index] = true
      needsRender.current = true
    }
    const waitForFrame = () => {
      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(() => {
          video.pause()
          finish()
        })
        void video.play().catch(finish)
      } else {
        finish()
      }
    }
    const seekToStart = () => {
      if (Math.abs(video.currentTime) < 0.02) {
        waitForFrame()
        return
      }
      video.addEventListener('seeked', waitForFrame, { once: true })
      video.currentTime = 0
    }

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) seekToStart()
    else {
      video.addEventListener('loadeddata', seekToStart, { once: true })
      video.load()
    }
  }, [])

  const drawBitmap = useCallback((bitmap: ImageBitmap) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    const renderWidth = Math.round(width * pixelRatio)
    const renderHeight = Math.round(height * pixelRatio)
    if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
      canvas.width = renderWidth
      canvas.height = renderHeight
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const scale = Math.max(width / bitmap.width, height / bitmap.height)
    const drawWidth = bitmap.width * scale
    const drawHeight = bitmap.height * scale
    context.clearRect(0, 0, width, height)
    context.drawImage(
      bitmap,
      (width - drawWidth) / 2,
      (height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    )
    forceRedraw.current = false
  }, [])

  const setLayerOpacity = useCallback((element: HTMLElement | null, opacity: number) => {
    if (!element) return
    const nextOpacity = clamp(opacity).toFixed(4)
    if (element.style.opacity !== nextOpacity) element.style.opacity = nextOpacity
  }, [])

  const updateText = useCallback(
    (fromScene: number, toScene: number, localProgress: number, holdScene?: number) => {
      textRefs.current.forEach((text, index) => {
        let opacity = 0
        let offset = 16
        if (holdScene === index) {
          opacity = 1
          offset = 0
        } else if (index === fromScene) {
          opacity = 1 - clamp(localProgress / TEXT_BLEND)
          offset = -10 * (1 - opacity)
        } else if (index === toScene) {
          opacity = clamp((localProgress - (1 - TEXT_BLEND)) / TEXT_BLEND)
          offset = 16 * (1 - opacity)
        }
        text.style.opacity = opacity.toFixed(4)
        text.style.visibility = opacity > 0.001 ? 'visible' : 'hidden'
        text.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`
      })
    },
    [],
  )

  const syncVideos = useCallback((playingScene: number | null) => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return
      if (idlePreparing.current[index]) return
      if (index === playingScene && idleReady.current[index]) {
        if (video.paused) void video.play().catch(() => undefined)
      } else if (!video.paused) {
        video.pause()
      }
    })
  }, [])

  const prepareSequence = useCallback(
    (transitionIndex: number, scrollDirection: number) => {
      if (lightweight) return
      const directionKey = `${transitionIndex}:${scrollDirection >= 0 ? 'forward' : 'reverse'}`
      if (preparedDirection.current === directionKey) return
      preparedDirection.current = directionKey

      const transition = transitions[transitionIndex]
      const targetScene = scrollDirection >= 0 ? transition.toScene : transition.fromScene
      prepareIdle(targetScene, true)
      const targetStill = stillRefs.current[targetScene]
      if (targetStill) targetStill.loading = 'eager'

      const boundaryFrame =
        scrollDirection >= 0
          ? transition.frameStart
          : transition.frameStart + transition.frameCount - 1
      void store
        .load(transitionIndex, () => {
          needsRender.current = true
        })
        .then((result) => {
          if (result.loaded === 0) failedSequences.current.add(transitionIndex)
          return store.decodeWindow(transitionIndex, boundaryFrame, 10)
        })
        .then(() => {
          needsRender.current = true
        })
        .catch(() => failedSequences.current.add(transitionIndex))

      const adjacentIndex = transitionIndex + (scrollDirection >= 0 ? 1 : -1)
      const adjacent = transitions[adjacentIndex]
      if (adjacent) {
        const adjacentBoundary =
          scrollDirection >= 0
            ? adjacent.frameStart
            : adjacent.frameStart + adjacent.frameCount - 1
        void store
          .load(adjacentIndex)
          .then(() => store.decodeWindow(adjacentIndex, adjacentBoundary, 8))
          .catch(() => undefined)
      }
      store.releaseDistant(transitionIndex)
    },
    [lightweight, prepareIdle, store],
  )

  const renderRequestedFrame = useCallback(
    (transitionIndex: number, transition: TransitionAsset, localProgress: number) => {
      const frame =
        transition.frameStart + Math.round(localProgress * (transition.frameCount - 1))
      const exact = store.getDecoded(transitionIndex, frame)
      if (exact && (lastFrame.current !== frame || forceRedraw.current)) {
        drawBitmap(exact)
        canvasTransition.current = transitionIndex
        lastFrame.current = frame
      } else if (!exact && canvasTransition.current !== transitionIndex) {
        const nearest = store.nearestDecoded(transitionIndex, frame)
        if (nearest) {
          drawBitmap(nearest)
          canvasTransition.current = transitionIndex
          lastFrame.current = frame
        }
      }

      if (!exact) {
        void store.decode(transitionIndex, frame).then(() => {
          needsRender.current = true
        }).catch(() => undefined)
      }
      store.prewarm(transitionIndex, frame, 7)
      return frame
    },
    [drawBitmap, store],
  )

  const renderMasterProgress = useCallback(
    (masterProgress: number) => {
      const state = resolveMasterProgress(masterProgress)
      const stillOpacities = scenes.map(() => 0)
      const videoOpacities = scenes.map(() => 0)
      let canvasOpacity = 0
      let fallbackOpacity = 0
      let frame = -1
      let layer = 'still'
      let playingScene: number | null = null

      if (state.kind === 'hold') {
        const sceneIndex = state.sceneIndex
        markActiveScene(sceneIndex)
        stillOpacities[sceneIndex] = 1
        if (!idleReady.current[sceneIndex]) prepareIdle(sceneIndex)
        videoOpacities[sceneIndex] = idleReady.current[sceneIndex] ? 1 : 0
        playingScene = sceneIndex
        updateText(sceneIndex, sceneIndex, 0, sceneIndex)
        activeTransition.current = -1
        preparedDirection.current = ''
        layer = videoOpacities[sceneIndex] > 0 ? 'idle' : 'still'
      } else {
        const transitionIndex = state.segment.transitionIndex
        const transition = transitions[transitionIndex]
        const localProgress = state.localProgress
        markActiveScene(localProgress < 0.5 ? transition.fromScene : transition.toScene)
        prepareSequence(transitionIndex, direction.current)
        activeTransition.current = transitionIndex

        const outgoingBlend = clamp(localProgress / VISUAL_BLEND)
        const incomingBlend = clamp((localProgress - (1 - VISUAL_BLEND)) / VISUAL_BLEND)
        const outgoingVideoOpacity = clamp(1 - outgoingBlend / 0.5)
        const incomingVideoOpacity = clamp((incomingBlend - 0.45) / 0.55)

        stillOpacities[transition.fromScene] = 1 - outgoingBlend
        stillOpacities[transition.toScene] = incomingBlend
        videoOpacities[transition.fromScene] = idleReady.current[transition.fromScene]
          ? outgoingVideoOpacity
          : 0
        videoOpacities[transition.toScene] = idleReady.current[transition.toScene]
          ? incomingVideoOpacity
          : 0

        frame = lightweight
          ? transition.frameStart + Math.round(localProgress * (transition.frameCount - 1))
          : renderRequestedFrame(transitionIndex, transition, localProgress)
        const hasCurrentCanvas = canvasTransition.current === transitionIndex
        canvasOpacity =
          localProgress < VISUAL_BLEND
            ? outgoingBlend
            : localProgress > 1 - VISUAL_BLEND
              ? 1 - incomingBlend
              : 1

        if (lightweight) {
          canvasOpacity = 0
          if (localProgress < 0.5) stillOpacities[transition.fromScene] = 1
          else stillOpacities[transition.toScene] = 1
        } else if (!hasCurrentCanvas) {
          canvasOpacity = 0
          if (localProgress < 0.5) stillOpacities[transition.fromScene] = 1
          else stillOpacities[transition.toScene] = 1
        }

        if (failedSequences.current.has(transitionIndex)) {
          const fallback = fallbackRef.current
          if (fallback) {
            if (fallbackTransition.current !== transitionIndex) {
              fallbackTransition.current = transitionIndex
              fallback.src = transition.fallback
              fallback.load()
            }
            if (fallback.readyState >= HTMLMediaElement.HAVE_METADATA) {
              fallback.currentTime = Math.min(
                fallback.duration - 0.01,
                fallback.duration * localProgress,
              )
            }
          }
          fallbackOpacity = canvasOpacity
          canvasOpacity = 0
        }

        if (localProgress < VISUAL_BLEND) playingScene = transition.fromScene
        else if (localProgress > 1 - VISUAL_BLEND) playingScene = transition.toScene
        updateText(transition.fromScene, transition.toScene, localProgress)
        layer = fallbackOpacity > 0.01
          ? 'fallback'
          : canvasOpacity > 0.01
            ? 'canvas'
            : Math.max(...videoOpacities) > 0.01
              ? 'idle'
              : 'still'
      }

      stillRefs.current.forEach((still, index) =>
        setLayerOpacity(still, stillOpacities[index]),
      )
      videoRefs.current.forEach((video, index) =>
        setLayerOpacity(video, videoOpacities[index]),
      )
      setLayerOpacity(canvasRef.current, canvasOpacity)
      setLayerOpacity(fallbackRef.current, fallbackOpacity)
      syncVideos(playingScene)

      if (canvasRef.current) {
        const local = state.kind === 'transition' ? state.localProgress : 1
        const transitionLabel =
          state.kind === 'transition' ? String(state.segment.transitionIndex + 1) : 'hold'
        canvasRef.current.dataset.masterProgress = masterProgress.toFixed(4)
        canvasRef.current.dataset.transition = transitionLabel
        canvasRef.current.dataset.localProgress = local.toFixed(4)
        canvasRef.current.dataset.frame = frame < 0 ? '' : String(frame)
        canvasRef.current.dataset.activeLayer = layer
      }
    },
    [
      lightweight,
      markActiveScene,
      prepareIdle,
      prepareSequence,
      renderRequestedFrame,
      setLayerOpacity,
      syncVideos,
      updateText,
    ],
  )

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      textRefs.current = Array.from(document.querySelectorAll<HTMLElement>('[data-scene-copy]'))
      if (lightweight) {
        await Promise.all([
          preloadImageWithRetry(scenes[0].still),
          preloadImageWithRetry(scenes[1].still),
        ])
      } else {
        const heroVideo = videoRefs.current[0]
        if (heroVideo) {
          heroVideo.currentTime = 0
          await waitForVideo(heroVideo)
          idleReady.current[0] = true
        }
        const result = await store.load(0, (progress) => {
          if (!cancelled) setLoadingProgress(Math.round(progress * 85))
        })
        if (result.loaded > 0) {
          await store.decodeWindow(0, transitions[0].frameStart, 10)
        }
      }

      if (cancelled) return
      setLoadingProgress(100)
      setReady(true)
      needsRender.current = true
      if (!lightweight) {
        // Warm every remaining sequence in the background, in order, rather than
        // only the next one on arrival. Sequence 1 used to be the only one with
        // a head start — it downloaded while the visitor read the hero — so the
        // later transitions began fetching only once they were already on
        // screen and never caught up. Downloading them all up front is the
        // difference between "usually works" and "always works": the bytes are
        // compressed blobs, retained for the session, and cost a fraction of
        // what the decoded bitmaps do.
        void (async () => {
          for (let index = 1; index < transitions.length; index += 1) {
            if (cancelled) return
            try {
              await store.load(index)
              if (cancelled) return
              // Only the sequence about to be entered needs bitmaps ready; the
              // rest decode on demand from bytes that are already local.
              if (index === 1) await store.decodeWindow(1, transitions[1].frameStart, 8)
            } catch {
              /* a sequence that fails here is retried by the loader on entry */
            }
          }
        })()
      }
      await document.fonts.ready
      if (!cancelled) ScrollTrigger.refresh()
    }
    void initialize()
    return () => {
      cancelled = true
    }
  }, [lightweight, store])

  useEffect(() => {
    if (!ready) return
    const tick = () => {
      const progress = desiredProgress.current
      if (!needsRender.current && Math.abs(progress - lastProgress.current) < 0.00001) return
      direction.current = progress >= lastProgress.current ? 1 : -1
      renderMasterProgress(progress)
      lastProgress.current = progress
      needsRender.current = false
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [ready, renderMasterProgress])

  useEffect(() => {
    const resize = () => {
      forceRedraw.current = true
      needsRender.current = true
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(
    () => () => {
      videoRefs.current.forEach((video, index) => {
        idleTokens.current[index] += 1
        video?.pause()
      })
      store.dispose()
    },
    [store],
  )

  useGSAP(
    () => {
      if (!ready || !trackRef.current) return
      const master = ScrollTrigger.create({
        trigger: trackRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
        onRefresh: ({ progress }) => {
          desiredProgress.current = progress
          needsRender.current = true
        },
        onUpdate: ({ progress }) => {
          desiredProgress.current = progress
          needsRender.current = true
        },
      })
      desiredProgress.current = master.progress
      needsRender.current = true
    },
    { dependencies: [ready, trackRef], revertOnUpdate: true },
  )

  return (
    <>
      <div className="visual-stage" aria-hidden="true">
        <div className="visual-stage__stills">
          {scenes.map((scene, index) => (
            <img
              className="visual-layer still-layer"
              key={scene.id}
              ref={(element) => {
                stillRefs.current[index] = element
              }}
              src={scene.still}
              alt=""
              loading={index < 2 ? 'eager' : 'lazy'}
              style={{ opacity: index === 0 ? 1 : 0 }}
              onLoad={(event) => clearMediaRetry(event.currentTarget)}
              onError={(event) => {
                retryMediaElement(event.currentTarget, scene.still)
              }}
            />
          ))}
        </div>
        {scenes.map((scene, index) => (
          <video
            className="visual-layer idle-layer"
            key={scene.id}
            ref={(element) => {
              videoRefs.current[index] = element
            }}
            src={scene.idle}
            muted
            loop
            autoPlay={index === 0}
            playsInline
            preload={index < 2 ? 'auto' : 'metadata'}
            style={{ opacity: index === 0 ? 1 : 0 }}
            onLoadedData={(event) => clearMediaRetry(event.currentTarget)}
            onError={(event) => {
              idlePreparing.current[index] = false
              idleReady.current[index] = false
              needsRender.current = true
              retryMediaElement(event.currentTarget, scene.idle)
            }}
          />
        ))}
        <canvas ref={canvasRef} className="visual-layer visual-stage__canvas" />
        <video
          ref={fallbackRef}
          className="visual-layer transition-fallback"
          muted
          playsInline
          preload="metadata"
        />
        <div className="visual-stage__grain" />
        <div className="visual-stage__vignette" />
      </div>
      <LoadingScreen progress={loadingProgress} ready={ready} />
    </>
  )
}
