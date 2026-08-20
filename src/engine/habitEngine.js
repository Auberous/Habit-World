// Habit Engine — pure, framework-free logic that turns habit logs into
// world state. This is the single source of truth for "what does the world
// look like right now"; the RN world view and the Unity bridge both just
// render whatever this produces. Keeping it pure (no I/O, no React, no
// Unity APIs) means it can be unit-tested standalone and ported to C#
// later without dragging in UI concerns.

/**
 * @typedef {Object} HabitDefinition
 * @property {string} id
 * @property {string} name
 * @property {string} colorId  // one of habits.json colors[].id
 */

/**
 * @typedef {Object} HabitLogEntry
 * @property {string} habitId
 * @property {string} date  // ISO yyyy-mm-dd
 */

const DECAY_PER_MISSED_DAY = 0.5; // color level lost per consecutive day a habit isn't logged

/**
 * Computes each color's level (0..maxLevelPerColor) from raw habit logs.
 * @param {HabitDefinition[]} habits - the user's chosen habits (1-6)
 * @param {HabitLogEntry[]} logs - all completion logs
 * @param {object} habitsConfig - parsed shared/config/habits.json
 * @param {string} today - ISO date, injectable for tests
 */
export function computeColorLevels(habits, logs, habitsConfig, today) {
  const maxLevel = habitsConfig.maxLevelPerColor;
  const levels = Object.fromEntries(habitsConfig.colors.map((c) => [c.id, 0]));

  for (const habit of habits) {
    const habitLogs = logs.filter((l) => l.habitId === habit.id).map((l) => l.date).sort();
    if (habitLogs.length === 0) continue;

    const completions = habitLogs.length;
    const missedStreak = daysSinceLastLog(habitLogs[habitLogs.length - 1], today);
    const raw = Math.min(maxLevel, completions * 0.4) - missedStreak * DECAY_PER_MISSED_DAY;
    const clamped = Math.max(0, Math.min(maxLevel, raw));

    levels[habit.colorId] = Math.max(levels[habit.colorId] ?? 0, clamped);
  }

  return levels;
}

function daysSinceLastLog(lastDateIso, todayIso) {
  const last = new Date(lastDateIso);
  const now = new Date(todayIso);
  const diffMs = now.getTime() - last.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000) - 1); // day of logging itself doesn't count as missed
}

/**
 * Resolves which biomes are unlocked given current color levels.
 * @param {object} colorLevels - { green: 2.4, blue: 0, ... }
 * @param {object} biomesConfig - parsed shared/config/biomes.json
 */
export function unlockedBiomes(colorLevels, biomesConfig) {
  return biomesConfig.biomes
    .filter((b) => (colorLevels[b.unlockRule.color] ?? 0) >= b.unlockRule.minLevel)
    .map((b) => b.id);
}

/**
 * Resolves which animals are currently spawned.
 * @param {object} colorLevels
 * @param {object} animalsConfig - parsed shared/config/animals.json
 * @param {object} streaks - { [colorId]: currentStreakDays }
 */
export function spawnedAnimals(colorLevels, animalsConfig, streaks = {}) {
  return animalsConfig.animals
    .filter((a) => {
      const level = colorLevels[a.spawnRule.color] ?? 0;
      if (level < a.spawnRule.minLevel) return false;
      if (a.spawnRule.requiresStreakDays) {
        return (streaks[a.spawnRule.color] ?? 0) >= a.spawnRule.requiresStreakDays;
      }
      return true;
    })
    .map((a) => a.id);
}

/**
 * Resolves which weather patterns are currently active.
 * @param {object} colorLevels
 * @param {object} weatherConfig - parsed shared/config/weather.json
 * @param {object} streaks
 */
export function activeWeather(colorLevels, weatherConfig, streaks = {}) {
  return weatherConfig.patterns
    .filter((w) => {
      if (w.default || w.trigger?.always) return true;
      if (!w.trigger) return false;
      const level = colorLevels[w.trigger.color] ?? 0;
      if (level < w.trigger.minLevel) return false;
      if (w.trigger.requiresStreakDays) {
        return (streaks[w.trigger.color] ?? 0) >= w.trigger.requiresStreakDays;
      }
      return true;
    })
    .map((w) => w.id);
}

/**
 * Top-level convenience: builds the full world state snapshot that gets
 * synced to Unity (as JSON) or rendered directly by the RN world view.
 */
export function computeWorldState({ habits, logs, streaks = {}, config, today }) {
  const colorLevels = computeColorLevels(habits, logs, config.habits, today);
  return {
    colorLevels,
    unlockedBiomes: unlockedBiomes(colorLevels, config.biomes),
    spawnedAnimals: spawnedAnimals(colorLevels, config.animals, streaks),
    activeWeather: activeWeather(colorLevels, config.weather, streaks),
    generatedAt: today,
  };
}
