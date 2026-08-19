# Habit World

A React Native app built with Expo. Today's milestone: an animated fog/cloud
background rendered live via Expo Go on a phone.

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

5. The app should load and show the animated dusty-plains background with
   drifting clouds and fog wisps.

## Notes

- `App.js` was previously cut off mid-line inside the `fog3` style (`backgroundColor: 'rgba(255`), which caused an `Unterminated string constant` error. It's now complete, matching `fog1`/`fog2` at a lower opacity (`rgba(255,255,255,0.18)`), and `StyleSheet.create({...})` is properly closed.
