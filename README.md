# Habit World (EverWorld)

A React Native app built with Expo. See [ARCHITECTURE.md](./ARCHITECTURE.md)
for the full picture: a data-driven habit engine, JSON-configured biomes /
animals / weather, a Unity renderer spec, and a backend schema — plus an
honest read on what's actually runnable today versus what's a reviewed but
untested starting point.

The app now has a real flow: onboarding → pick 1-6 habits (each tagged to
one of six color domains) → daily tracker → world view (currently the
original fog/cloud background plus a text readout of unlocked biomes /
animals / weather, pending the Unity terrain embed).

## Running it

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the Expo dev server:

   ```bash
   npx expo start
   ```

3. A QR code prints in the terminal (and opens in a browser tab at
   `http://localhost:8081`).

4. On your phone:
   - **iOS**: install the free **Expo Go** app from the App Store, then open
     your phone's Camera app and point it at the QR code — it'll prompt you
     to open the link in Expo Go.
   - **Android**: install the free **Expo Go** app from the Google Play
     Store, open Expo Go, and use its built-in "Scan QR code" option to scan
     the code from the terminal/browser.

   Your phone and computer need to be on the **same Wi-Fi network** for this
   to work. If it doesn't connect, run `npx expo start --tunnel` instead,
   which routes through a public tunnel and works across networks (slower,
   but avoids Wi-Fi/firewall issues).

5. Walk through onboarding, pick a habit or two, log them, and tap "View
   your world" to see the current world-state readout.

## Notes

- `App.js` is now a screen router (onboarding/habits/tracker/world) driven
  by `src/engine/habitEngine.js`, rather than a single static screen.
- No new npm dependencies were added — habit logs live in memory for now
  (reset on reload) until a backend is wired up per `backend/README.md`.
