import { useEffect, useRef, type RefObject } from 'react'

interface ChapterRailProps {
  activeScene: number
  trackRef: RefObject<HTMLElement | null>
}

export function ChapterRail({ activeScene, trackRef }: ChapterRailProps) {
  const layerRef = useRef<HTMLDivElement>(null)
  const cueRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const track = trackRef.current
      const layer = layerRef.current
      if (!track || !layer) return
      const trackTop = track.getBoundingClientRect().top + window.scrollY
      const distance = Math.max(1, track.offsetHeight - window.innerHeight)
      const progress = Math.min(1, Math.max(0, (window.scrollY - trackTop) / distance))
      layer.style.setProperty('--journey-progress', progress.toFixed(4))
      if (cueRef.current) cueRef.current.style.opacity = String(Math.max(0, 1 - progress / 0.025))
    }
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [trackRef])

  return (
    <div className="chapter-rail-layer" ref={layerRef}>
      {activeScene === 0 && (
        <div className="scroll-cue" ref={cueRef} aria-hidden="true">
          <span />
          SCROLL TO DESCEND
        </div>
      )}

      <div className="mobile-progress-line" aria-hidden="true"><span /></div>
    </div>
  )
}
