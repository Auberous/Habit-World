import AsyncStorage from '@react-native-async-storage/async-storage';

const BEST_DISTANCE_KEY = '@orbit-dash/best-distance';

export async function loadBestDistance(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BEST_DISTANCE_KEY);
    const parsed = raw ? parseFloat(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function saveBestDistance(distance: number): Promise<void> {
  try {
    await AsyncStorage.setItem(BEST_DISTANCE_KEY, String(distance));
  } catch {
    // Best-effort only — losing the record locally isn't fatal.
  }
}
