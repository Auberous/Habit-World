// Cinematic first-launch intro: barren world reveal -> camera glide into
// high-oblique view -> a scripted preview of what habits actually do to
// the world -> hand off to the real app. Purely illustrative — the levels
// animated here are local to this component and never touch the user's
// real habit/world state (see useWorldState.ts for that).
import { useEffect, useRef, useState } from 'react';
import { EMPTY_LEVELS, type Levels } from './habitData';
import { renderWorldSvg } from './worldRenderer';
import { startAmbientAudio, type AmbientAudioHandle } from './audio/ambientAudio';
import { markIntroSeen } from './introSeen';
import './IntroScene.css';

interface Step {
  levels: Levels;
  caption: string;
  holdMs: number;
}

const STEPS: Step[] = [
  {
    levels: EMPTY_LEVELS,
    caption:
      'EverWorld is a living landscape that grows as you grow. Every habit you improve brings new life, colour, weather, and creatures into your world.',
    holdMs: 4200,
  },
  {
    levels: { ...EMPTY_LEVELS, green: 1 },
    caption: 'One healthy choice — an apple instead of nothing — and life takes root.',
    holdMs: 2800,
  },
  {
    levels: { ...EMPTY_LEVELS, green: 1, blue: 3 },
    caption: 'Drink water, and a stream begins to run through the land.',
    holdMs: 2800,
  },
  {
    levels: { ...EMPTY_LEVELS, green: 3, blue: 4 },
    caption: 'Keep going, and the stream widens, the first trees spread.',
    holdMs: 2800,
  },
  {
    levels: { green: 3, blue: 4, brown: 2, grey: 0, pink: 0 },
    caption: 'Discipline builds shelter — the beginning of a village.',
    holdMs: 2800,
  },
  {
    levels: { green: 4, blue: 4, brown: 3, grey: 2, pink: 3 },
    caption: 'Community gathers. Wildlife returns to a world healthy enough to support it.',
    holdMs: 3000,
  },
  {
    levels: { green: 4, blue: 5, brown: 5, grey: 3, pink: 5 },
    caption: 'This is what consistency looks like — a whole world, alive.',
    holdMs: 4000,
  },
];

export default function IntroScene({ onDone }: { onDone: () => void }) {
  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AmbientAudioHandle | null>(null);
  const timerRef = useRef<number | null>(null);

  const onLastStep = stepIndex >= STEPS.length - 1;
  const finished = started && onLastStep;

  // Advance through the scripted steps once started. Reaching the last step
  // is derived above rather than set here, so this effect only ever does
  // one thing: schedule the next step (or nothing, once there isn't one).
  useEffect(() => {
    if (!started || onLastStep) return undefined;
    timerRef.current = window.setTimeout(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, STEPS[stepIndex].holdMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [started, stepIndex, onLastStep]);

  function handleBegin() {
    setStarted(true);
    // Audio can only start from inside a real user gesture — this handler
    // is one, so this is the one legal place to call it.
    audioRef.current = startAmbientAudio();
  }

  function finishIntro() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    audioRef.current?.stop(1.2);
    markIntroSeen();
    onDone();
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    audioRef.current?.setMuted(next);
  }

  useEffect(() => {
    return () => {
      audioRef.current?.stop(0.05);
    };
  }, []);

  const step = STEPS[stepIndex];
  // Barren-world close-up on the very first frame, then a slow camera
  // glide out to the full high-oblique view once the sequence begins.
  const zoomedIn = !started || stepIndex === 0;

  return (
    <div className="intro">
      <div className={`intro-stage${zoomedIn ? ' intro-stage-zoomed' : ''}`}>
        <svg
          viewBox="0 0 700 420"
          preserveAspectRatio="xMidYMid slice"
          className="intro-svg"
          dangerouslySetInnerHTML={{ __html: renderWorldSvg(started ? step.levels : EMPTY_LEVELS) }}
        />
      </div>

      <div className="intro-vignette" />

      <button className="intro-skip" onClick={finishIntro}>
        Skip
      </button>

      {started && (
        <button className="intro-mute" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇' : '🔊'}
        </button>
      )}

      <div className="intro-caption-wrap">
        {!started ? (
          <div className="intro-welcome">
            <h1>EverWorld</h1>
            <p>{STEPS[0].caption}</p>
            <button className="intro-begin-btn" onClick={handleBegin}>
              Begin
            </button>
          </div>
        ) : (
          <p key={stepIndex} className="intro-caption">
            {step.caption}
          </p>
        )}

        {finished && (
          <button className="intro-continue-btn" onClick={finishIntro}>
            Enter EverWorld
          </button>
        )}
      </div>
    </div>
  );
}
