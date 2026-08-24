export interface Scene {
  alignment: 'left' | 'right'
  description: string
  eyebrow: string
  id: string
  idle: string
  italicPhrase?: string
  navigationLabel: string
  still: string
  theme: 'dark' | 'light'
  title: string
  titleLines: readonly [string, string]
}

export const scenes: readonly Scene[] = [
  {
    id: 'village',
    eyebrow: 'CHAPTER I / CANOPY VILLAGE',
    navigationLabel: 'Village',
    alignment: 'left',
    theme: 'dark',
    title: 'A Village Above the Clouds',
    titleLines: ['A Village', 'Above the Clouds'],
    italicPhrase: 'Clouds',
    description: 'At first light, the rooftops wake and small promises rise into the blue.',
    still: '/assets/stills/01-hero.png',
    idle: '/assets/idles/01-hero.mp4',
  },
  {
    id: 'community-hall',
    eyebrow: 'CHAPTER II / THE GATHERING HALL',
    navigationLabel: 'Gathering',
    alignment: 'right',
    theme: 'light',
    title: 'Where Every Table Has a Story',
    titleLines: ['Where Every Table', 'Has a Story'],
    description: 'Recipes, rumours, and old songs pass from hand to hand beneath the rafters.',
    still: '/assets/stills/02-community-hall.png',
    idle: '/assets/idles/02-community-hall.mp4',
  },
  {
    id: 'workshop',
    eyebrow: 'CHAPTER III / WATER WORKSHOP',
    navigationLabel: 'Workshop',
    alignment: 'left',
    theme: 'light',
    title: 'Crafted by Hand, Powered by Water',
    titleLines: ['Crafted by Hand,', 'Powered by Water'],
    description: 'River-driven gears turn slowly, shaping objects made to outlast their makers.',
    still: '/assets/stills/03-workshop.png',
    idle: '/assets/idles/03-workshop.mp4',
  },
  {
    id: 'root-garden',
    eyebrow: 'CHAPTER IV / ROOT GARDEN',
    navigationLabel: 'Garden',
    alignment: 'right',
    theme: 'light',
    title: 'Life Beneath the Roots',
    titleLines: ['Life Beneath', 'the Roots'],
    description: 'Below the oldest tree, patient hands tend the quiet work of growing.',
    still: '/assets/stills/04-root-garden.png',
    idle: '/assets/idles/04-root-garden.mp4',
  },
  {
    id: 'sunset-valley',
    eyebrow: 'CHAPTER V / BEYOND THE HOLLOW',
    navigationLabel: 'Beyond',
    alignment: 'left',
    theme: 'light',
    title: 'The Way Home',
    titleLines: ['The Way', 'Home'],
    description: 'At golden hour, every path across the valley begins to feel like home.',
    still: '/assets/stills/05-sunset.png',
    idle: '/assets/idles/05-sunset.mp4',
  },
] as const
