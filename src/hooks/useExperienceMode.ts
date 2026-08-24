import { useEffect, useState } from 'react'

export function useExperienceMode() {
  const [mode, setMode] = useState(() => ({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    mobile: window.matchMedia('(max-width: 767px), (pointer: coarse)').matches,
  }))

  useEffect(() => {
    const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const mobileQuery = window.matchMedia('(max-width: 767px), (pointer: coarse)')
    const update = () => {
      setMode({ reducedMotion: reducedQuery.matches, mobile: mobileQuery.matches })
    }
    reducedQuery.addEventListener('change', update)
    mobileQuery.addEventListener('change', update)
    return () => {
      reducedQuery.removeEventListener('change', update)
      mobileQuery.removeEventListener('change', update)
    }
  }, [])

  return { ...mode, lightweight: mode.reducedMotion || mode.mobile }
}
