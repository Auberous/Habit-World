# Orbit Dash

A gravity-slingshot arcade game built with Expo/React Native. Drag back from
Earth to launch a ship, then ride real Newtonian gravity — including
gravity-assist flybys off the planets — as far out of the solar system as you
can get.

This is a standalone Expo app, independent of the other prototypes in this
repo (`App.js` at the repo root, and `everworld/`).

## Current state: bare physics prototype

This build is deliberately minimal — one star, two planets on circular
orbits, and a ship governed by real inverse-square gravity from all three.
The goal right now is purely "does slingshotting feel good," before any of
the zoom levels, game modes, hazards, or sound design in the full concept
get layered on. See [Ideas for next passes](#ideas-for-next-passes) below
for what's deliberately not built yet.

## Running it

```bash
cd orbit-dash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS/Android) or press `w` for the web
preview.

## How it plays

- **Drag back** from the green launch pad (like a slingshot) and **release**
  to launch the ship.
- Flight is pure gravity: the Sun and both planets each pull on the ship by
  the inverse-square law, every frame, no scripted paths.
- Pass close to a planet with the right angle and you get a gravity-assist
  turn — the trajectory bends and the ship picks up (or loses) speed
  depending on the approach.
- Fly outside the escape radius → **"Escaped the system!"**
- Fly through the Sun or a planet → **"Crashed"**
- Tap anywhere after a crash/escape to reset and aim again.

## Project structure

- `App.tsx` — app shell (safe area, status bar), mounts `SlingshotGame`.
- `src/orbitalPhysics.ts` — the physics: body definitions (Sun + planets),
  gravity acceleration, collision detection, and a fixed-substep integrator.
  Pure functions, no React — easy to unit test or retune independent of
  rendering.
- `src/SlingshotGame.tsx` — game state machine (aiming / flying / crashed /
  escaped), the drag-to-launch gesture (`PanResponder`), the
  `requestAnimationFrame` sim loop, and the `react-native-svg` rendering of
  orbits, bodies, trail, and ship.
- `src/geometry.ts` — polar/SVG-arc helpers, reused from the previous
  tap-to-dodge prototype.

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

## The full concept (not built yet)

The design target this prototype is aimed at:

- **Zoom levels**: Inner Solar System → Gas Giant Belt → Ice Giants → Kuiper
  Zone → Interstellar Space, each wider, faster, and introducing new hazards
  (comet tails, debris, radiation belts).
- **Game modes**: Escape Mode (reach interstellar space), Endless Mode (best
  distance), Challenge Mode (timed slingshots, precision arcs), Sandbox Mode
  (tweak gravity/planet speed/rocket mass).
- **Visual style**: minimalist neon-vector — glowing planet spheres, clean
  arc trajectories, a simple triangle/capsule rocket. (The current prototype
  already follows this direction.)
- **Sound**: low-hum ambient space audio, rising tones under acceleration,
  Doppler-shift on slingshots, quiet music in deep space.
- **Self-balancing design insight**: a botched slingshot loses speed, which
  drops the ship back inward, which creates another slingshot opportunity —
  forgiving without being easy.

## Ideas for next passes

1. Tune gravity/mass/power constants further — first pass already produces
   real curving flybys and escapes, but wants more playtesting.
2. Best-distance persistence (was AsyncStorage-backed in the previous
   prototype; removed since there's no scoring loop yet).
3. A second, more distant planet pass and a widening camera as the ship
   gets farther out — first step toward the zoom levels.
4. Endless Mode scoring (distance reached / bodies passed).
5. Sound + haptics on launch, flyby, crash.
