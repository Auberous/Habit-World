// Split out from IntroScene.tsx so that file can export only the component
// (keeps fast-refresh happy) — this is the small bit of shared, non-
// component state both App.tsx and IntroScene.tsx need.
const SEEN_KEY = 'everworld.introSeen.v1';

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(SEEN_KEY, 'true');
  } catch {
    // best-effort — if storage is unavailable the intro just replays next time
  }
}
