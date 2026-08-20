# EverWorld — Architecture

This document is the map of how the pieces fit together, and the honest
state of each piece as of this pass. See each subfolder's own README for
detail.

## Repo layout

```
/App.js                  Expo React Native app entry (screen router)
/src/
  engine/habitEngine.js    Pure habit -> world-state logic (tested, working)
  screens/                 Onboarding, habit selection, daily tracker, world view
/shared/config/
  habits.json               6 color domains + their unlocks
  biomes.json                biome unlock rules
  animals.json                per-animal spawn rules
  weather.json                 weather trigger rules
/unity/                  Unity project (renderer) — see unity/README.md
  Assets/Scripts/           WorldState.cs, HabitBridge.cs, WorldGrowthEngine.cs,
                             AnimalSpawnEngine.cs, WeatherController.cs, CameraController.cs
  Assets/StreamingAssets/    copies of shared/config/*.json for on-device reads
/backend/                Schema doc for Firestore/Supabase — not provisioned yet
/everworld/               The existing web prototype (Vite/React/SVG) — untouched,
                           still deployed to GitHub Pages, useful as a fast visual
                           sandbox for effects (fog, weather) before porting to Unity
```

## What's real right now

- **Habit engine** (`src/engine/habitEngine.js`): pure JS, no dependencies.
  Takes habit logs + the JSON configs and derives color levels, unlocked
  biomes, spawned animals, and active weather. Verified working — see the
  smoke test in this session's history; 12 days of a green habit correctly
  unlocked the forest biome and spawned fox/deer/rabbit.
- **RN screen flow**: Onboarding → pick 1-6 habits (each tagged to a color)
  → daily tracker (tap to log) → world view. All wired to the real engine,
  not mocked. Runs today via `npx expo start` + Expo Go, same as before.
  World view currently reuses the prototype's fog/cloud background as a
  placeholder and shows unlocked biomes / animals / weather as text —
  there's no 3D terrain yet, that's Unity's job.
- **JSON configs**: the six colors, biome unlock thresholds, per-animal
  spawn rules (including streak-gated rare creatures), weather triggers —
  all data, no code, so adding a new animal or biome is a config edit.

## What's specified but not runnable here

- **Unity project** (`/unity`): C# scripts for world growth, animal
  spawning/wander AI, weather VFX toggling, and the high-oblique camera
  rig, plus the `HabitBridge` that receives JSON state from the RN shell.
  This sandbox has no Unity Editor, so none of it has been compiled or
  opened in the Editor — treat it as a reviewed starting point to open on
  your own machine (Unity 2022 LTS+, URP), not verified-working code. A few
  spots are marked `TODO` where real content (prefabs, VFX assets) has to
  exist before the logic can do anything visible.
- **Backend**: schema only (`backend/README.md`) — no Firebase/Supabase
  project has been created. The app currently keeps habit logs in memory
  (lost on reload); wiring persistence is the next real milestone once
  you've picked Firebase vs. Supabase.

## Data flow (the one contract everything else depends on)

```
habit logs  →  computeWorldState()  →  WorldState JSON
                (src/engine/habitEngine.js)
                                            │
                        ┌───────────────────┴───────────────────┐
                        ▼                                       ▼
              RN WorldViewScreen                    Unity HabitBridge.ApplyWorldState()
              (renders badges today,                 (drives WorldGrowthEngine,
               will render the Unity                  AnimalSpawnEngine,
               view once embedded)                     WeatherController)
```

`computeWorldState()` is the single source of truth. Nothing else — not
Unity, not the RN world view, not a future backend cache — should ever
compute world state independently; they only ever render or cache its
output. That's what keeps "does the world look right" answerable by
reading one function instead of hunting for logic duplicated three places.

## Suggested phased roadmap

1. **Persistence** — pick Firebase or Supabase, provision the three tables
   in `backend/README.md`, swap the RN app's in-memory `logs` state for
   real reads/writes. Small, high-value, unblocks testing across sessions.
2. **Unity embed** — get a blank Unity scene rendering inside the RN app
   via Unity as a Library, with `HabitBridge` receiving a hardcoded test
   payload. Proves the plumbing before investing in real art.
3. **Terrain + one biome** — build the forest biome for real (ground mesh,
   a handful of tree/bush prefabs, the fox/deer/rabbit models with basic
   wander AI already stubbed in `AnimalSpawnEngine.cs`). Gets you one
   complete vertical slice to react to before building the other five.
4. **Weather + camera polish** — wire `WeatherController`'s VFX and get
   `CameraController`'s wake-up pan feeling right against the real terrain.
5. **Remaining five biomes** — mechanically repeat step 3's pattern per
   biome; the engine and config already support all six colors.

## Known open decisions

- **Firebase vs. Supabase** — either fits the documented schema; pick based
  on whether you want realtime subscriptions out of the box (Supabase) or
  tighter Google ecosystem integration (Firebase).
- **Unity embedding library** — `react-native-unity-view` is the common
  community choice; verify current maintenance status before committing,
  Unity-as-a-Library integrations tend to churn with RN/Unity version
  bumps.
- **Multi-habit-per-color** — the engine already takes the max across
  habits sharing a color (see `computeColorLevels`), so this isn't blocked,
  just not exercised by the current single-habit-per-color UI.
