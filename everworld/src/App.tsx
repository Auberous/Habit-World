import { lazy, Suspense, useState } from 'react';
import { CATEGORIES, MAX_LEVEL, vitalityPercent, type CategoryId } from './habitData';
import { renderWorldSvg } from './worldRenderer';
import { useWorldState } from './useWorldState';
import IntroScene from './IntroScene';
import { hasSeenIntro } from './introSeen';
import './App.css';

// Lazy: Babylon.js is ~315KB gzipped even tree-shaken down. Most visits
// never touch the 3D toggle, so it shouldn't cost anyone who doesn't.
const Scene3D = lazy(() => import('./world3d/Scene3D'));

const VIEW_3D_KEY = 'everworld.view3d.v1';

export default function App() {
  const [showIntro, setShowIntro] = useState(() => !hasSeenIntro());
  const [view3d, setView3d] = useState(() => {
    try {
      return localStorage.getItem(VIEW_3D_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const {
    levels,
    todaysCompletions,
    addHabit,
    removeHabit,
    toggleHabitCompletion,
    habitsForCategory,
    reset,
  } = useWorldState();
  const pct = vitalityPercent(levels);
  const svgInner = renderWorldSvg(levels);

  if (showIntro) {
    return <IntroScene onDone={() => setShowIntro(false)} />;
  }

  function toggleView3d() {
    const next = !view3d;
    setView3d(next);
    try {
      localStorage.setItem(VIEW_3D_KEY, String(next));
    } catch {
      // best-effort — the toggle still works for this session either way
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>EverWorld</h1>
        <p className="tagline">a world grown from habits</p>
      </header>

      <div className="stage">
        {view3d ? (
          <Suspense fallback={<div className="stage-loading">Loading 3D view…</div>}>
            <Scene3D levels={levels} />
          </Suspense>
        ) : (
          <svg
            viewBox="0 0 700 420"
            className="world-svg"
            dangerouslySetInnerHTML={{ __html: svgInner }}
          />
        )}
      </div>

      <button className="view3d-toggle-btn" onClick={toggleView3d}>
        {view3d ? '2D view' : '3D view (beta)'}
      </button>

      <div className="status-row">
        <span>World vitality: {pct}%</span>
        <button className="reset-btn" onClick={reset}>
          Reset world
        </button>
      </div>

      <div className="cat-list">
        {CATEGORIES.map((c) => (
          <CategorySection
            key={c.id}
            categoryId={c.id}
            name={c.name}
            color={c.color}
            desc={c.desc}
            level={levels[c.id]}
            habits={habitsForCategory(c.id)}
            todaysCompletions={todaysCompletions}
            onAddHabit={addHabit}
            onRemoveHabit={removeHabit}
            onToggleCompletion={toggleHabitCompletion}
          />
        ))}
      </div>

      <p className="footnote">
        Define your own habits under each colour, then tap one to log it for today. Each
        colour grows a different layer of the world — animals only appear once the habitat
        that supports them exists.
      </p>

      <button className="replay-intro-btn" onClick={() => setShowIntro(true)}>
        Watch the intro again
      </button>
    </div>
  );
}

interface CategorySectionProps {
  categoryId: CategoryId;
  name: string;
  color: string;
  desc: string;
  level: number;
  habits: { id: string; name: string; description?: string }[];
  todaysCompletions: string[];
  onAddHabit: (categoryId: CategoryId, name: string, description?: string) => void;
  onRemoveHabit: (habitId: string) => void;
  onToggleCompletion: (habitId: string) => void;
}

function CategorySection({
  categoryId,
  name,
  color,
  desc,
  level,
  habits,
  todaysCompletions,
  onAddHabit,
  onRemoveHabit,
  onToggleCompletion,
}: CategorySectionProps) {
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');

  function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!draftName.trim()) return;
    onAddHabit(categoryId, draftName, draftDesc);
    setDraftName('');
    setDraftDesc('');
    setAdding(false);
  }

  return (
    <section className="cat-card">
      <div className="cat-card-head">
        <span className="swatch" style={{ background: color }} />
        <div className="cat-card-title">
          <span className="cat-name">{name}</span>
          <span className="cat-desc">{desc}</span>
        </div>
        <span className="cat-level">Lv {level} / {MAX_LEVEL}</span>
      </div>

      <span className="bar-track">
        <span className="bar-fill" style={{ width: `${(level / MAX_LEVEL) * 100}%`, background: color }} />
      </span>

      {habits.length === 0 && !adding && (
        <p className="cat-empty">No habits yet under {name}.</p>
      )}

      <ul className="habit-list">
        {habits.map((h) => {
          const done = todaysCompletions.includes(h.id);
          return (
            <li key={h.id} className={`habit-row${done ? ' done' : ''}`}>
              <button
                type="button"
                className="habit-toggle"
                onClick={() => onToggleCompletion(h.id)}
                aria-pressed={done}
              >
                <span className="habit-checkbox">{done ? '✓' : ''}</span>
                <span className="habit-text">
                  <span className="habit-name">{h.name}</span>
                  {h.description && <span className="habit-description">{h.description}</span>}
                </span>
              </button>
              <button
                type="button"
                className="habit-remove"
                title={`Remove "${h.name}"`}
                onClick={() => onRemoveHabit(h.id)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form className="habit-form" onSubmit={submitDraft}>
          <input
            className="habit-input"
            placeholder={`e.g. what habit belongs under ${name}?`}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            autoFocus
          />
          <input
            className="habit-input habit-input-desc"
            placeholder="Optional description"
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
          />
          <div className="habit-form-actions">
            <button type="submit" className="habit-save-btn" disabled={!draftName.trim()}>
              Add habit
            </button>
            <button type="button" className="habit-cancel-btn" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="add-habit-btn" onClick={() => setAdding(true)}>
          + Add a habit
        </button>
      )}
    </section>
  );
}
