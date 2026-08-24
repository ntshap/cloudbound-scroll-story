import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { scenes } from '../data/scenes'

interface HeaderProps {
  activeScene: number
  onNavigate: (index: number) => void
}

function TreeRingMark() {
  return (
    <svg className="wordmark__mark" viewBox="0 0 36 36" aria-hidden="true">
      <path d="M18 3.5c7.8 0 14.2 6.5 14.2 14.5S25.8 32.5 18 32.5 3.8 26 3.8 18 10.2 3.5 18 3.5Z" />
      <path d="M18 8.5c5.2 0 9.4 4.2 9.4 9.5s-4.2 9.5-9.4 9.5S8.6 23.3 8.6 18s4.2-9.5 9.4-9.5Z" />
      <path d="M18 13.1c2.7 0 4.9 2.2 4.9 4.9s-2.2 4.9-4.9 4.9-4.9-2.2-4.9-4.9 2.2-4.9 4.9-4.9Z" />
      <path d="M18 3.5v29M18 18l7.7-6.2M18 18l-5.9 9" />
    </svg>
  )
}

export function Header({ activeScene, onNavigate }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const scene = scenes[activeScene]

  useEffect(() => setMenuOpen(false), [activeScene])

  const navigate = (index: number) => {
    onNavigate(index)
    setMenuOpen(false)
  }

  return (
    <header className={`site-header site-header--${scene.theme}${menuOpen ? ' is-menu-open' : ''}`}>
      <a
        className="wordmark"
        href="#village"
        aria-label="Cloudbound, return to beginning"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          navigate(0)
        }}
      >
        <TreeRingMark />
        <span>Cloudbound</span>
      </a>

      <div className="header-actions">
        <span className="header-chapter" aria-live="polite">
          {String(activeScene + 1).padStart(2, '0')} — {String(scenes.length).padStart(2, '0')}
        </span>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="chapter-menu"
          aria-label={menuOpen ? 'Close chapter menu' : 'Open chapter menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" size={17} /> : <Menu aria-hidden="true" size={17} />}
        </button>
      </div>

      <nav
        className={`chapter-menu${menuOpen ? ' is-open' : ''}`}
        id="chapter-menu"
        aria-label="Journey chapters"
        aria-hidden={!menuOpen}
      >
        <div className="chapter-menu__list">
          {scenes.map((menuScene, index) => (
            <a
              key={menuScene.id}
              href={`#${menuScene.id}`}
              className={index === activeScene ? 'is-active' : ''}
              aria-current={index === activeScene ? 'step' : undefined}
              tabIndex={menuOpen ? 0 : -1}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                navigate(index)
              }}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              {menuScene.title}
            </a>
          ))}
        </div>
      </nav>
    </header>
  )
}
