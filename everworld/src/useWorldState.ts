import { useEffect, useState } from 'react';
import { EMPTY_LEVELS, MAX_LEVEL, type CategoryId, type Levels } from './habitData';

const STORAGE_KEY = 'everworld.levels.v1';
const LOG_KEY = 'everworld.log.v1';

function loadLevels(): Levels {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_LEVELS };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_LEVELS, ...parsed };
  } catch {
    return { ...EMPTY_LEVELS };
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadLog(): Record<string, CategoryId[]> {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useWorldState() {
  const [levels, setLevels] = useState<Levels>(loadLevels);
  const [log, setLog] = useState<Record<string, CategoryId[]>>(loadLog);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
  }, [levels]);

  useEffect(() => {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  }, [log]);

  const todaysCompletions = log[todayKey()] ?? [];

  function completeHabit(id: CategoryId) {
    if (todaysCompletions.includes(id)) return;
    setLevels((prev) => ({ ...prev, [id]: Math.min(MAX_LEVEL, prev[id] + 1) }));
    setLog((prev) => {
      const key = todayKey();
      const existing = prev[key] ?? [];
      return { ...prev, [key]: [...existing, id] };
    });
  }

  function reset() {
    setLevels({ ...EMPTY_LEVELS });
    setLog({});
  }

  return { levels, todaysCompletions, completeHabit, reset };
}
