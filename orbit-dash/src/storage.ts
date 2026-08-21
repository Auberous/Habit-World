import AsyncStorage from '@react-native-async-storage/async-storage';

const BEST_SCORE_KEY = '@orbit-dash/best-score';

export async function loadBestScore(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(BEST_SCORE_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function saveBestScore(score: number): Promise<void> {
  try {
    await AsyncStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch {
    // Best-effort only — losing a high score locally isn't fatal.
  }
}
