const RETRY_DELAYS_MS = [250, 750, 1500] as const

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds))
}

export function buildRetryUrl(source: string, attempt: number) {
  if (attempt === 0) return source
  const base = globalThis.location?.href ?? 'https://cloudbound.local/'
  const url = new URL(source, base)
  url.searchParams.set('__cloudbound_retry', String(attempt))
  return source.startsWith('http') ? url.toString() : `${url.pathname}${url.search}${url.hash}`
}

export async function fetchAssetWithRetry(source: string, init: RequestInit = {}) {
  let lastError: unknown
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (attempt > 0) await delay(RETRY_DELAYS_MS[attempt - 1])
    try {
      const response = await fetch(buildRetryUrl(source, attempt), {
        ...init,
        cache: 'no-store',
      })
      if (response.ok) return response
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (init.signal?.aborted) throw error
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Asset request failed')
}

export function preloadImageWithRetry(source: string) {
  return new Promise<void>((resolve) => {
    let attempt = 0
    const image = new Image()
    const load = () => {
      image.src = buildRetryUrl(source, attempt)
    }
    image.onload = () => resolve()
    image.onerror = () => {
      if (attempt >= RETRY_DELAYS_MS.length) {
        resolve()
        return
      }
      const delayMs = RETRY_DELAYS_MS[attempt]
      attempt += 1
      window.setTimeout(load, delayMs)
    }
    load()
  })
}

export function retryMediaElement(element: HTMLImageElement | HTMLVideoElement, source: string) {
  const attempt = Number(element.dataset.cloudboundRetry ?? 0)
  if (attempt >= RETRY_DELAYS_MS.length) return false
  const nextAttempt = attempt + 1
  element.dataset.cloudboundRetry = String(nextAttempt)
  window.setTimeout(() => {
    element.src = buildRetryUrl(source, nextAttempt)
    if (element instanceof HTMLVideoElement) element.load()
  }, RETRY_DELAYS_MS[attempt])
  return true
}

export function clearMediaRetry(element: HTMLImageElement | HTMLVideoElement) {
  delete element.dataset.cloudboundRetry
}
