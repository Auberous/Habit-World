# Orbit Dash

A one-tap casual arcade game built with Expo/React Native. Your dot orbits a
central hub; gates spinning around the inner and outer ring block one lane at
a time. Tap anywhere to switch orbit lane and dodge through. The pace ramps
up the longer you survive, and your best score is saved on-device.

This is a standalone Expo app, independent of the other prototypes in this
repo (`App.js` at the repo root, and `everworld/`).

## Running it

```bash
cd orbit-dash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS/Android) or press `w` for the web
preview.

## How it plays

- **Tap** to swap between the inner and outer orbit.
- Orange gates block exactly one of the two lanes as they sweep past — be on
  the open lane when a gate reaches you.
- Score increments for every gate you clear; hitting a blocked lane ends the
  run.
- Your best score persists locally via `@react-native-async-storage/async-storage`.

## Project structure

- `App.tsx` — app shell (safe area, status bar), mounts `Game`.
- `src/Game.tsx` — game state machine (ready / playing / game over), the
  `requestAnimationFrame` loop driving orbit angle + obstacle spawning /
  collision, and the `react-native-svg` rendering of rings, gates, and the
  player.
- `src/geometry.ts` — polar-to-cartesian and SVG arc-path helpers.
- `src/storage.ts` — best-score persistence.

## Publishing

This app is set up for [EAS Build](https://docs.expo.dev/build/introduction/):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios      # or android, or --platform all
eas submit --platform ios     # after a successful build
```

Before submitting to the App Store / Play Store, replace the placeholder art
in `assets/` (`icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png` —
currently generated solid-color placeholders) with real game art, and update
`app.json`'s `ios.bundleIdentifier` / `android.package` if you want a
different bundle ID than `com.auberous.orbitdash`.

## Ideas for next passes

- Difficulty variants (double gates, moving gates).
- Combo/streak scoring, particle burst on lane switch.
- Leaderboard / cloud high scores.
- Sound + haptics on lane switch and collision.
