import type { ReactNode, RefObject } from 'react'
import { MASTER_TRACK_VH } from '../data/assets'
import { scenes } from '../data/scenes'
import { SceneContent } from './SceneContent'

interface StoryScrollerProps {
  children: ReactNode
  trackRef: RefObject<HTMLElement | null>
}

export function StoryScroller({ children, trackRef }: StoryScrollerProps) {
  return (
    <main className="story">
      <section
        ref={trackRef}
        className="story-track"
        style={{ height: `${MASTER_TRACK_VH}vh` }}
        aria-label="A journey through five scenes"
      >
        <div className="story-sticky">
          {children}
          <div className="story-content">
            {scenes.map((scene) => (
              <div className={`scene-copy-slot scene-copy-slot--${scene.alignment}`} key={scene.id}>
                <SceneContent scene={scene} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
