import { useEffect, useState } from 'react';
import { EMPTY_LEVELS, MAX_LEVEL, type CategoryId, type Habit, type Levels } from './habitData';

const HABITS_KEY = 'everworld.habits.v1';
const COMPLETIONS_KEY = 'everworld.completions.v1'; // dateKey -> habitId[]

function loadHabits(): Habit[] {
  try {
    const raw = localStorage.getItem(HABITS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadCompletions(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(COMPLETIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// A category's level is the number of distinct days on which at least one
// of its habits was completed, capped at MAX_LEVEL. Multiple habits in the
// same category completed on the same day still only count once for that
// day — this preserves the original "one growth step per category per
// day" pacing now that a category can hold several habits rather than
// being a single tap-to-complete tile itself.
function computeLevels(habits: Habit[], completions: Record<string, string[]>): Levels {
  const categoryOf = new Map(habits.map((h) => [h.id, h.categoryId]));
  const daysHitByCategory: Record<CategoryId, Set<string>> = {
    blue: new Set(),
    green: new Set(),
    brown: new Set(),
    grey: new Set(),
    pink: new Set(),
  };

  Object.entries(completions).forEach(([date, habitIds]) => {
    habitIds.forEach((habitId) => {
      const categoryId = categoryOf.get(habitId);
      if (categoryId) daysHitByCategory[categoryId].add(date);
    });
  });

  const levels = { ...EMPTY_LEVELS };
  (Object.keys(levels) as CategoryId[]).forEach((id) => {
    levels[id] = Math.min(MAX_LEVEL, daysHitByCategory[id].size);
  });
  return levels;
}

export function useWorldState() {
  const [habits, setHabits] = useState<Habit[]>(loadHabits);
  const [completions, setCompletions] = useState<Record<string, string[]>>(loadCompletions);

  useEffect(() => {
    localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem(COMPLETIONS_KEY, JSON.stringify(completions));
  }, [completions]);

  const todaysCompletions = completions[todayKey()] ?? [];
  const levels = computeLevels(habits, completions);

  function addHabit(categoryId: CategoryId, name: string, description?: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const habit: Habit = {
      id: `${categoryId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      categoryId,
      name: trimmed,
      description: description?.trim() || undefined,
      createdAt: Date.now(),
    };
    setHabits((prev) => [...prev, habit]);
  }

  function removeHabit(habitId: string) {
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    // Note: levels are recomputed from scratch from (habits, completions)
    // on every render, and computeLevels can only attribute a logged
    // completion to a category via a *currently existing* habit. So if a
    // removed habit was the only completion logged in its category on a
    // given day, that day stops counting and the category's level can
    // drop. Worth revisiting (e.g. snapshot categoryId onto each
    // completion at log time) if that turns out to feel wrong in practice.
  }

  function toggleHabitCompletion(habitId: string) {
    const key = todayKey();
    setCompletions((prev) => {
      const existing = prev[key] ?? [];
      const next = existing.includes(habitId)
        ? existing.filter((id) => id !== habitId)
        : [...existing, habitId];
      return { ...prev, [key]: next };
    });
  }

  function habitsForCategory(categoryId: CategoryId): Habit[] {
    return habits.filter((h) => h.categoryId === categoryId);
  }

  function reset() {
    setHabits([]);
    setCompletions({});
  }

  return {
    habits,
    levels,
    todaysCompletions,
    addHabit,
    removeHabit,
    toggleHabitCompletion,
    habitsForCategory,
    reset,
  };
}
