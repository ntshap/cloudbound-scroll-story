import { useCallback, useEffect, useRef } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export function useSmoothScroll(disabled: boolean) {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (disabled) return

    const lenis = new Lenis({
      anchors: true,
      lerp: 0.14,
      smoothWheel: true,
      wheelMultiplier: 0.75,
    })
    lenisRef.current = lenis
    const update = (time: number) => lenis.raf(time * 1000)

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(update)
      lenis.off('scroll', ScrollTrigger.update)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [disabled])

  return useCallback((top: number) => {
    const lenis = lenisRef.current
    if (lenis) lenis.scrollTo(top)
    else window.scrollTo({ top, behavior: 'auto' })
  }, [])
}

