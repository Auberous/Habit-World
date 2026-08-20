# EverWorld

A gamified habit app: a low-poly world that grows from barren to lush as real-life
habits are completed. Five habit colors each grow a different layer of the world.

| Color | Habit type              | Grows                              |
|-------|--------------------------|-------------------------------------|
| Blue  | Sleep, hydration, calm   | Sky, weather, water                |
| Green | Movement, learning       | Vegetation — bushes to forest      |
| Brown | Chores, discipline       | Structures — huts to a monument    |
| Grey  | Connection, community    | Population                         |
| Pink  | Rest, joy, self-care     | Wildlife (gated by Green — animals only spawn where there's habitat) |

## Stack

- Vite + React + TypeScript
- No backend yet — state persists to `localStorage` (see `src/useWorldState.ts`)
- Mobile-viewport-first CSS (`src/App.css`), built to be wrapped with Capacitor later

## Structure

- `src/habitData.ts` — category definitions, level math, stage labels
- `src/worldRenderer.ts` — pure function, `Levels -> SVG string`. All the visual logic
  for what unlocks at each level lives here. This is the file to extend when adding
  new world elements.
- `src/useWorldState.ts` — habit completion, one-per-day-per-category logic, persistence
- `src/App.tsx` — layout / UI

## Run it

```
npm install
npm run dev
```

## Known gaps / next steps

This is a working prototype of the core loop (tap a category once a day, watch the
world grow), not a finished app. Still to build:

1. **Real habit list** — right now each "category" is a single tap-to-complete tile.
   Needs actual named, user-created habits (e.g. "Drink 2L water" under Blue),
   possibly with presets per category plus custom habit creation.
2. **Auth + cloud sync** — currently `localStorage` only, single device.
3. **Daily reset / streaks** — habits currently allow one completion per calendar day
   (see `todaysCompletions` in `useWorldState.ts`) but there's no streak tracking,
   no weekly view, and no decay mechanic yet for missed days.
4. **Decay behavior** — undecided. Options discussed: gradual desaturation, wilting
   vegetation, fog, or no penalty at all (pure growth). Needs a decision before
   building.
5. **More world content per level** — `worldRenderer.ts` currently has 5-6 discrete
   tiers per category; could use more granularity and more variety (asset variation,
   not just count).
6. **Capacitor wrap** for iOS/Android once the core loop feels right.
7. **Notifications / reminders** — native-only feature, phase 2.

## Design intent (for whoever picks this up)

The world should feel like the main character, not a progress bar wearing a skin.
Every visual addition should be a consequence of a real behavior, and animals should
never feel like they were "bought" directly — they should feel discovered, gated by
whether the world can actually support them.
