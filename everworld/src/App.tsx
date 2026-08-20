import { CATEGORIES, MAX_LEVEL, vitalityPercent } from './habitData';
import { renderWorldSvg } from './worldRenderer';
import { useWorldState } from './useWorldState';
import './App.css';

export default function App() {
  const { levels, todaysCompletions, completeHabit, reset } = useWorldState();
  const pct = vitalityPercent(levels);
  const svgInner = renderWorldSvg(levels);

  return (
    <div className="app">
      <header className="header">
        <h1>EverWorld</h1>
        <p className="tagline">a world grown from habits</p>
      </header>

      <div className="stage">
        <svg
          viewBox="0 0 700 420"
          className="world-svg"
          dangerouslySetInnerHTML={{ __html: svgInner }}
        />
      </div>

      <div className="status-row">
        <span>World vitality: {pct}%</span>
        <button className="reset-btn" onClick={reset}>
          Reset world
        </button>
      </div>

      <div className="cat-grid">
        {CATEGORIES.map((c) => {
          const level = levels[c.id];
          const doneToday = todaysCompletions.includes(c.id);
          return (
            <button
              key={c.id}
              className={`cat-card${doneToday ? ' done' : ''}`}
              onClick={() => completeHabit(c.id)}
              disabled={doneToday}
            >
              <span className="swatch" style={{ background: c.color }} />
              <span className="cat-name">{c.name}</span>
              <span className="cat-desc">{c.desc}</span>
              <span className="bar-track">
                <span
                  className="bar-fill"
                  style={{ width: `${(level / MAX_LEVEL) * 100}%`, background: c.color }}
                />
              </span>
              <span className="cat-level">
                {doneToday ? 'Logged today' : `Lv ${level} / ${MAX_LEVEL}`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="footnote">
        Tap a category once a day to log a habit. Each color grows a different layer of the
        world — animals only appear once the habitat that supports them exists.
      </p>
    </div>
  );
}
