import { useCallback, useRef, useState } from 'react'
import { ChapterRail } from './components/ChapterRail'
import { Header } from './components/Header'
import { StoryScroller } from './components/StoryScroller'
import { VisualStage } from './components/VisualStage'
import { sceneBoundaryProgress } from './data/assets'
import { useExperienceMode } from './hooks/useExperienceMode'
import { useSmoothScroll } from './hooks/useSmoothScroll'

export default function App() {
  const [activeScene, setActiveScene] = useState(0)
  const trackRef = useRef<HTMLElement>(null)
  const { lightweight, reducedMotion } = useExperienceMode()
  const scrollTo = useSmoothScroll(reducedMotion)

  const navigateToScene = useCallback((index: number) => {
    const track = trackRef.current
    if (!track) return
    const trackTop = track.getBoundingClientRect().top + window.scrollY
    const scrollDistance = Math.max(0, track.offsetHeight - window.innerHeight)
    scrollTo(trackTop + sceneBoundaryProgress[index] * scrollDistance)
  }, [scrollTo])

  return (
    <div className="app-shell">
      <Header activeScene={activeScene} onNavigate={navigateToScene} />
      <StoryScroller trackRef={trackRef}>
        <VisualStage
          lightweight={lightweight}
          onActiveSceneChange={setActiveScene}
          trackRef={trackRef}
        />
      </StoryScroller>
      <ChapterRail activeScene={activeScene} trackRef={trackRef} />
    </div>
  )
}
