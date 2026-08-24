import type { Scene } from '../data/scenes'

interface SceneContentProps {
  scene: Scene
}

function renderTitleLine(line: string, italicPhrase?: string) {
  if (!italicPhrase || !line.includes(italicPhrase)) return line
  const [before, after] = line.split(italicPhrase)
  return <>{before}<em>{italicPhrase}</em>{after}</>
}

export function SceneContent({ scene }: SceneContentProps) {
  return (
    <article
      className={`scene-copy scene-copy--${scene.alignment} scene-copy--${scene.theme}`}
      id={scene.id}
      data-scene-copy
      aria-labelledby={`${scene.id}-title`}
    >
      <div className="scene-copy__inner">
        <p className="scene-copy__eyebrow"><span />{scene.eyebrow}</p>
        <h1 id={`${scene.id}-title`} aria-label={scene.title}>
          {scene.titleLines.map((line) => (
            <span className="scene-copy__line" key={line}>
              {renderTitleLine(line, scene.italicPhrase)}
            </span>
          ))}
        </h1>
        <p className="scene-copy__description">{scene.description}</p>
      </div>
    </article>
  )
}
