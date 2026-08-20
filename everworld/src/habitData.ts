export type CategoryId = 'blue' | 'green' | 'brown' | 'grey' | 'pink';

export interface Category {
  id: CategoryId;
  name: string;
  color: string;
  desc: string;
}

export const MAX_LEVEL = 5;

export const CATEGORIES: Category[] = [
  { id: 'blue', name: 'Blue', color: '#4f8fd1', desc: 'Sleep, hydration, calm' },
  { id: 'green', name: 'Green', color: '#5a9d5c', desc: 'Movement, learning, growth' },
  { id: 'brown', name: 'Brown', color: '#9a7452', desc: 'Chores, focus, discipline' },
  { id: 'grey', name: 'Grey', color: '#8b8b86', desc: 'Connection, community' },
  { id: 'pink', name: 'Pink', color: '#d97fa0', desc: 'Rest, joy, self-care' },
];

export type Levels = Record<CategoryId, number>;

export const EMPTY_LEVELS: Levels = {
  blue: 0,
  green: 0,
  brown: 0,
  grey: 0,
  pink: 0,
};

export function vitalityPercent(levels: Levels): number {
  const total = Object.values(levels).reduce((s, v) => s + v, 0);
  return Math.round((total / (CATEGORIES.length * MAX_LEVEL)) * 100);
}

export function stageLabel(pct: number): string {
  if (pct === 0) return 'Barren';
  if (pct < 25) return 'Stirring';
  if (pct < 50) return 'Sprouting';
  if (pct < 75) return 'Thriving';
  if (pct < 100) return 'Flourishing';
  return 'Alive';
}
