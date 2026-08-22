# Orbit Dash

A gravity-slingshot arcade game built with Expo/React Native. Drag back from
Earth to launch a ship, then ride real Newtonian gravity — including
gravity-assist flybys off the planets — as far out of the solar system as you
can get.

This is a standalone Expo app, independent of the other prototypes in this
repo (`App.js` at the repo root, and `everworld/`).

## Current state: a skill loop, not a fire-and-forget prototype

The real solar system (Mercury through Neptune, real AU spacing, real
relative sizes/masses) and a ship under real inverse-square gravity from all
nine bodies — plus, on top of that physics core, the pieces that turn it
from "drag and watch" into something you have to learn:

- **Real planets, real ratios**: orbital distances follow real AU ratios
  linearly; orbital speed is derived per-planet from Kepler's third law, not
  hand-tuned (Mercury visibly swings around, Neptune barely moves during a
  flight — same as it would for a real spacecraft); body size and mass
  follow real ratios compressed by a shared `sqrt()` so the range stays
  screen-sane while gas giants still dwarf the inner planets and the Sun
  still dominates everything. See `src/orbitalPhysics.ts` for the exact
  scaling and the tradeoff it's making.
- **Escape is genuinely hard now**: the Sun's mass is realistic enough
  relative to max launch speed that a direct, unassisted shot physically
  cannot reach local escape velocity — it will always arc back inward. Real
  gravity assists (ideally from Jupiter or Saturn, exactly like the actual
  Voyager missions) are mandatory, not optional flavor.
- **A reason to try again**: best distance reached persists on-device and
  shows live in the HUD; beating it fires a "new best distance" moment
  instead of a generic game-over. Passing Mars' orbit, the asteroid belt,
  Jupiter, Saturn, Uranus, and Neptune each fire a one-time named toast on
  the way out — small wins on the way to the big one, instead of an
  all-or-nothing wall. This is the fix for "the outcome feels pointless":
  every attempt now has something to compare against and remember.

- **Risk-zone rings** around every body while aiming: green (safe, small
  assist), yellow (bigger assist, real risk), red (collision). Skimming the
  yellow ring without crossing into red is the actual skill.
- **Fuzzy trajectory preview**: a short, dotted, fading preview line shows
  where your current pull is about to send the ship — but only ~2.6 seconds
  ahead. Anything past that (later flybys, whether you actually escape)
  isn't solved for you; you have to fly it and learn to lead the planets.
- **Escape-velocity readout**: the HUD shows your current speed against the
  local escape speed (`sqrt(2GM/r)`) at your distance from the Sun, colored
  green/orange. This is what actually gates progress outward — it's not a
  scripted checkpoint, it's the real orbital-mechanics threshold, so a weak
  launch will legitimately fall back inward for another attempt.
- **Rubber-band launch** with a much bigger, cinematic scale and a camera
  that zooms out as you travel (see below) — unchanged from the previous
  pass.

See [Ideas for next passes](#ideas-for-next-passes) for the parts of the
full design (fuel/thrust bursts, launch windows, capture-into-orbit,
checkpoints) that are deliberately not built yet.

## Running it

```bash
cd orbit-dash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (iOS/Android) or press `w` for the web
preview.

## How it plays

- The camera **opens wide** on arrival — enough to see out past Saturn —
  so you can actually survey the field and pick a strategy before
  committing to a shot. It eases into the tight aiming view the moment you
  touch down to drag.
- **Pull back** from the green launch pad like a slingshot — the elastic
  gets visibly harder to stretch the farther you pull (diminishing returns,
  not a linear power bar) — and **release** to launch.
- While aiming: colored rings around the Sun and each planet show green
  (safe assist) / yellow (high-risk, high-reward) / red (collision) zones,
  and a short dotted preview shows roughly where that pull is about to send
  you — a few seconds ahead, not the whole flight.
- Flight is pure gravity: the Sun and all eight planets each pull on the
  ship by the inverse-square law, every frame, no scripted paths. Skim a
  yellow ring for a strong assist; cross into red and it's a collision.
  Jupiter and Saturn are by far the strongest assists available — real mass
  ratios mean Mercury/Venus/Mars barely nudge your trajectory, same as the
  real solar system.
- The HUD shows your speed against the escape speed needed at your current
  distance. Fall short and you'll curve back inward for another attempt
  instead of drifting out forever — that's real orbital mechanics, not a
  scripted wall.
- Passing Mars' orbit, the asteroid belt, Jupiter, Saturn, Uranus, or
  Neptune for the first time in a run pops a named toast. Your farthest
  distance ever reached persists on-device and shows in the HUD as "best" —
  beating it is called out explicitly when a run ends.
- Cross the escape radius while still above local escape speed →
  **"Escape velocity reached."** Fly through the Sun or a planet's collision
  radius → **"Lost in the [body] flyby."**
- Tap anywhere after a crash/escape to reset and aim again.

## Project structure

- `App.tsx` — app shell (safe area, status bar), mounts `SlingshotGame`.
- `src/orbitalPhysics.ts` — the physics: body definitions (Sun + planets),
  gravity acceleration, collision detection, a fixed-substep integrator,
  risk-ring radii, and the local escape-speed formula. Pure functions, no
  React — easy to unit test or retune independent of rendering.
- `src/SlingshotGame.tsx` — game state machine (aiming / flying / crashed /
  escaped), the drag-to-launch gesture (`PanResponder`), the wide-to-tight
  intro camera zoom, the fuzzy trajectory preview (a short forward
  simulation re-run on every pointer move), the `requestAnimationFrame` sim
  loop, and the `react-native-svg` rendering of orbits, bodies, trail, and
  the ship (hull + engine flame + cockpit, not a bare triangle).
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

From the "what makes this addictive" design pass — the reward loop
(persisted best distance, named milestones) landed; these are the pieces
still deliberately deferred, each meant to land as its own reviewable
change rather than one large rewrite:

1. **In-flight assist feedback** — a floating "+340 km/s — Jupiter assist"
   callout and a visual pulse the instant a close pass pays off, so a good
   slingshot is rewarding in the moment, not just reflected in the final
   distance number.
2. **Fuel/thrust bursts** — a finite fuel bar for mid-flight course
   corrections, with periapsis burns worth far more than burns elsewhere —
   gives every launch and correction real stakes instead of a free instant
   retry. Needs its own bit of UI (fuel bar) and state (burn input during
   flight).
3. **Launch windows/optimal cone** — restrict launch to a narrow angle range
   depending on where the planets currently are, instead of any angle being
   launchable at any time.
4. **Capture-into-orbit as a third failure mode** — right now every mistake
   is either a crash or a fall-back for another attempt; a "weak flyby traps
   you in orbit, burn remaining fuel to break free" state needs fuel to
   exist first.
5. **Checkpoints + failure hints** — remember progress within a run and
   surface what went wrong ("too shallow", "too fast") instead of a flat
   restart.
6. **Retention hooks** — a daily challenge seed (same planet phases each
   day, shareable/comparable like Wordle) and cosmetic unlocks spent from
   mission points, once there's a currency to spend.
7. The zoom levels / game modes / sound design from the original full
   concept (see above) remain the long-range target.