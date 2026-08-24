export interface TransitionAsset {
  id: string
  directory: string
  fallback: string
  frameCount: number
  frameHeight: number
  framePrefix: string
  frameStart: number
  frameWidth: number
  fromScene: number
  toScene: number
}

export const transitions: readonly TransitionAsset[] = [
  {
    id: 'hero-to-hall',
    directory: '/assets/transitions/01-hero-to-hall',
    fallback: '/assets/transitions/01-hero-to-hall/fallback.mp4',
    frameCount: 78,
    frameHeight: 1440,
    framePrefix: 'frame_',
    frameStart: 1,
    frameWidth: 2560,
    fromScene: 0,
    toScene: 1,
  },
  {
    id: 'hall-to-workshop',
    directory: '/assets/transitions/02-hall-to-workshop',
    fallback: '/assets/transitions/02-hall-to-workshop/fallback.mp4',
    frameCount: 78,
    frameHeight: 1440,
    framePrefix: 'frame_',
    frameStart: 1,
    frameWidth: 2560,
    fromScene: 1,
    toScene: 2,
  },
  {
    id: 'workshop-to-garden',
    directory: '/assets/transitions/03-workshop-to-garden',
    fallback: '/assets/transitions/03-workshop-to-garden/fallback.mp4',
    frameCount: 78,
    frameHeight: 1440,
    framePrefix: 'frame_',
    frameStart: 1,
    frameWidth: 2560,
    fromScene: 2,
    toScene: 3,
  },
  {
    id: 'garden-to-sunset',
    directory: '/assets/transitions/04-garden-to-sunset',
    fallback: '/assets/transitions/04-garden-to-sunset/fallback.mp4',
    frameCount: 78,
    frameHeight: 1440,
    framePrefix: 'frame_',
    frameStart: 1,
    frameWidth: 2560,
    fromScene: 3,
    toScene: 4,
  },
] as const

export const MASTER_TRACK_VH = 420
export const SCENE_HOLD_SHARE = 0.03
export const TRANSITION_SHARE =
  (1 - SCENE_HOLD_SHARE * (transitions.length - 1)) / transitions.length

export interface TransitionTimelineSegment {
  end: number
  holdEnd: number
  start: number
  transitionIndex: number
}

let timelineCursor = 0
export const transitionTimeline: readonly TransitionTimelineSegment[] = transitions.map(
  (_, transitionIndex) => {
    const start = timelineCursor
    const end = start + TRANSITION_SHARE
    const holdEnd =
      transitionIndex < transitions.length - 1 ? end + SCENE_HOLD_SHARE : end
    timelineCursor = holdEnd
    return { transitionIndex, start, end, holdEnd }
  },
)

export const sceneBoundaryProgress = [
  0,
  ...transitionTimeline.map((segment) => segment.end),
] as const

export type MasterTimelineState =
  | {
      kind: 'transition'
      localProgress: number
      segment: TransitionTimelineSegment
    }
  | {
      kind: 'hold'
      sceneIndex: number
      segment: TransitionTimelineSegment
    }

export function resolveMasterProgress(progress: number): MasterTimelineState {
  const boundedProgress = Math.min(1, Math.max(0, progress))
  for (const segment of transitionTimeline) {
    if (boundedProgress <= segment.end || segment.transitionIndex === transitions.length - 1) {
      return {
        kind: 'transition',
        localProgress: Math.min(
          1,
          Math.max(0, (boundedProgress - segment.start) / (segment.end - segment.start)),
        ),
        segment,
      }
    }
    if (boundedProgress <= segment.holdEnd) {
      return { kind: 'hold', sceneIndex: segment.transitionIndex + 1, segment }
    }
  }
  return {
    kind: 'hold',
    sceneIndex: transitions.length,
    segment: transitionTimeline.at(-1)!,
  }
}

export function getFramePath(transition: TransitionAsset, frame: number) {
  const filename = `${transition.framePrefix}${String(frame).padStart(6, '0')}.webp`
  return `${transition.directory}/${filename}`
}
