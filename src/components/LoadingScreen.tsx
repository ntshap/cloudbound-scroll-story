interface LoadingScreenProps {
  progress: number
  ready: boolean
}

export function LoadingScreen({ progress, ready }: LoadingScreenProps) {
  return (
    <div className={`loader${ready ? ' loader--ready' : ''}`} aria-live="polite">
      <div className="loader__mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="loader__wordmark">Cloudbound</p>
      <div className="loader__track">
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <p className="loader__status">Preparing the path · {Math.round(progress)}%</p>
    </div>
  )
}

