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

- `src/habitData.ts` — category definitions, the `Habit` type, level math, stage labels
- `src/worldRenderer.ts` — pure function, `Levels -> SVG string`. All the visual logic
  for what unlocks at each level lives here. This is the file to extend when adding
  new world elements. Unaffected by the habit changes below — it only ever sees
  `Levels`, never habits directly.
- `src/useWorldState.ts` — user-created habits (add/remove), per-habit daily
  completion log, persistence, and deriving each category's `Levels` from that log
  (a category's level is the number of distinct days on which *any* of its habits
  was completed, capped at `MAX_LEVEL` — preserves the original one-growth-step-
  per-category-per-day pacing now that a category can hold several habits)
- `src/App.tsx` — layout / UI: one section per category, listing its habits with a
  daily checkbox each, plus an inline "+ Add a habit" form

## Run it

```
npm install
npm run dev
```

## Known gaps / next steps

This is a working prototype of the core loop (tap a category once a day, watch the
world grow), not a finished app. Still to build:

1. ~~**Real habit list**~~ — done: each category now holds actual named,
   user-created habits (e.g. "Drink 2L water" under Blue), added/removed inline,
   each with its own daily checkbox. No presets — habit text is always user-supplied.
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
8. ~~**Ambient motion**~~ — done: trees/bushes sway, animals wander continuously
   (not just a one-shot walk-in), birds fly real loops on a motion path, the river
   flows (animated dash offset) and can spill into a waterfall once mountains are
   tall enough, villagers get a repeating hammering gesture, mountains scale with
   overall vitality (with snow caps at the top tier), and a rain + rainbow moment
   appears at max sky level. All CSS-driven (`worldRenderer.ts`'s `AnimCtx` helpers) —
   `renderWorldSvg` is still a pure, cheap function; the browser's compositor does
   the actual animating, no render loop needed.
9. **Real fidelity jump** (rigged/lifelike creature motion, true depth/lighting) —
   the next tier up from (8)'s CSS-driven motion. Decided: Babylon.js. Phase 0+1
   (below) is done; see `src/world3d/` and the phased plan there for what's next.

## The Babylon.js 3D track (`src/world3d/`)

The chosen fidelity path from item 9 above. Lives alongside the 2D SVG view
rather than replacing it — a "3D view (beta)" toggle in the header
(persisted to `localStorage`) swaps `<Scene3D>` in for the `<svg>` in
`.stage`. Both views read the same `Levels` from `useWorldState`, so they
never disagree about what the world contains.

- `src/world3d/buildWorld3d.ts` — scene setup (camera/lights/ground, once)
  plus a disposable "growth root" of placeholder primitives (boxes, cones,
  spheres, tubes) rebuilt from `Levels` using the *same* growth thresholds
  as `worldRenderer.ts` — trees at `green >= 2`, huts at `brown >= 1`, a
  river at `blue >= 3`, a waterfall once mountains are tall enough, rain +
  rainbow at `blue === 5`, etc. All animation (sway, wander, river flow,
  rain, bird flight, a villager's hammering) runs off one shared per-frame
  loop (`scene.onBeforeRenderObservable`) driving a list of `{mesh, kind,
  ...}` entries — cheap and easy to extend with a new `AnimKind`.
- `src/world3d/Scene3D.tsx` — the React `<canvas>` wrapper: owns the
  `World3D` instance's lifecycle, re-syncs growth when `levels` changes.
- Imports are deep (`@babylonjs/core/Engines/engine`, not the
  `@babylonjs/core` barrel) — the barrel pulls in the *entire* engine
  (audio, physics stubs, GLTF, ~6.6MB before gzip); deep imports tree-shake
  the bundle down to ~315KB gzipped for what this scene actually uses.
  Keep new Babylon imports deep too, or the bundle regresses hard.

### Phased plan

- **Phase 0 — Setup.** ✅ Done: `@babylonjs/core` added, tree-shaken correctly.
- **Phase 1 — Bootstrap.** ✅ Done: high-oblique `ArcRotateCamera` (slow idle
  orbit, matching the 2D view's framing), lighting, ground, real `Levels`
  data wired in, and *every* growth element from the 2D renderer ported as
  placeholder geometry — including continuous animation (sway, wander,
  river flow, rain, bird flight) via the shared per-frame loop. Verified
  with headless Playwright: renders correctly at zero habits (barren) and
  at full bloom, no console errors, toggling back to 2D works cleanly.
  Known rough edge: at high mountain tiers, a mountain can occlude part of
  the rainbow arc — camera framing/composition wasn't tuned yet, since this
  phase was about proving the pipeline, not final composition.
- **Phase 2 — Real assets (not started).** Swap the placeholder
  boxes/cones/spheres for actual low-poly models: free, CC0-licensed packs
  from **Kenney.nl** and **Quaternius** (trees, rocks, simple buildings,
  animals) — matches the low-poly aesthetic with zero licensing risk.
  Requires picking specific packs, downloading/importing `.glb` models
  (Babylon's `SceneLoader`), and re-pointing each placeholder spawn call at
  a loaded model instead of a `MeshBuilder` primitive.
- **Phase 3 — Rigged character animation (not started).** Real walk/idle/
  build animations for villagers and creatures via **Mixamo** (free,
  auto-rigs a mesh and hands back mocap animation clips) imported as
  `.glb`/`.fbx` and played through Babylon's `AnimationGroup`s — replaces
  the current procedural bob/wander placeholders with actual skeletal
  animation.
- **Phase 4 — Terrain, lighting, sky polish (not started).** Real
  heightmap-based ground (rolling hills, not a flat plane), a proper
  gradient/skybox sky (currently a flat `clearColor`), directional
  shadows, and fixing the mountain/rainbow occlusion noted above.
- **Phase 5 — Mobile/perf pass (not started).** Test on an actual phone
  (not just desktop headless Chromium), tune draw calls/mesh counts,
  confirm the WebView-in-Expo-Go path from the earlier native-app spec
  still applies if that direction is revisited, and decide whether the
  3D view becomes the default or stays opt-in.

## Design intent (for whoever picks this up)

The world should feel like the main character, not a progress bar wearing a skin.
Every visual addition should be a consequence of a real behavior, and animals should
never feel like they were "bought" directly — they should feel discovered, gated by
whether the world can actually support them.
