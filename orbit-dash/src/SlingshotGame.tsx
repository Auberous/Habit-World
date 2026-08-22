import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { PanResponder } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Polygon, Polyline, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import {
  computeBodies,
  ESCAPE_RADIUS,
  integrateShip,
  LAUNCH_PAD,
  localEscapeSpeed,
  MILESTONES,
  planetPosition,
  PLANETS,
  riskRadii,
  VIEW_RADIUS,
  vLen,
  vSub,
  type BodyState,
  type Vec2,
} from './orbitalPhysics';
import { generateStars } from './starfield';
import { loadBestDistance, saveBestDistance } from './storage';

const TOAST_DURATION_MS = 2600;

type Phase = 'aiming' | 'flying' | 'crashed' | 'escaped';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOARD_SIZE = Math.min(SCREEN_W, SCREEN_H * 0.68);
const CENTER = BOARD_SIZE / 2;

// Oblique "looking across the ecliptic plane" projection: orbits render as
// ellipses instead of circles, the way the real solar system would look
// from a Voyager-style vantage a little above the plane.
const TILT = 0.58;

// Rubber-band launch: power grows fast at first, then resists — the same
// diminishing-return curve a real elastic gives as it stretches further.
const DRAG_SOFTNESS = 100; // world units of pull for ~63% of max power
const MAX_DRAG_VISUAL = 260; // world units the band can visibly stretch to
const MAX_LAUNCH_SPEED = 380;

const TRAIL_LENGTH = 140;
const SHIP_RADIUS = 6;
const DISTANCE_RING_STEP = 750; // roughly AU-spaced at this project's scale

// Camera opens wide enough to see out past Saturn so you can actually
// strategize the shot, then eases in to the tight aiming view once you
// touch down to drag — the wide view is for planning, not for throwing.
const OVERVIEW_RADIUS = 1700;
const INTRO_ZOOM_MS = 1700;

// The trajectory preview only looks this far ahead — a fuzzy near-term read,
// not a solved answer. Anything beyond it (later flybys, the actual escape)
// still has to be learned by flying it.
const PREVIEW_SECONDS = 2.6;
const PREVIEW_DT = 1 / 20;

// Ghost markers: where each planet will actually be a bit from now, so
// leading a distant target is a visual read instead of a memorized guess.
const GHOST_LEAD_SECONDS = 10;

// Hold the "preview orbits" control during aiming to fast-forward the
// planets (without moving the ship) and watch for a good alignment —
// the same thing a real mission designer does when picking a launch window.
const FAST_FORWARD_SPEED = 40;

// Two correction burns per flight: a fixed prograde delta-v. Deliberately
// small — a burn alone (from a straight, unassisted launch) can never
// close the gap to escape velocity; it's a nudge for a trajectory that's
// already mostly working, not a way to skip needing a real gravity assist.
// (This falls naturally out of the same physics as a real Oberth
// maneuver: delta-v added at high speed near a body buys far more energy
// than the same delta-v added anywhere else, so a burn during a genuine
// close flyby is worth much more than the raw number below suggests.)
const BURN_CHARGES = 2;
const BURN_DELTA_V = 22;

// The camera stays Sun-centered through the inner system (where the risk
// rings/preview matter most), then eases into following the ship itself
// once it's genuinely out in deep space, so a far-out ship never gets lost
// near the edge of frame.
const FOLLOW_START_DIST = 500;
const FOLLOW_FULL_DIST = 2200;

// Assist feedback: the speed change between entering and leaving a body's
// "safe" risk ring, called out the instant a flyby ends — so a good
// slingshot is obviously rewarding right when it happens, not just a curve
// on a line you have to infer credit from.
const ASSIST_CALLOUT_MS = 2200;
const ASSIST_MIN_DELTA = 8;
const ASSIST_RISE_PX = 26;

const STARS = generateStars(160);

function bodyDisplayName(id: string): string {
  return id === 'sun' ? 'the Sun' : capitalize(id);
}

function toScreen(p: Vec2, scale: number, center: Vec2): Vec2 {
  return { x: CENTER + (p.x - center.x) * scale, y: CENTER + (p.y - center.y) * scale * TILT };
}

function screenDeltaToWorld(dx: number, dy: number, scale: number): Vec2 {
  return { x: dx / scale, y: dy / (scale * TILT) };
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

export default function SlingshotGame() {
  const [phase, setPhase] = useState<Phase>('aiming');
  const [, setRenderTick] = useState(0);
  const [aimDrag, setAimDrag] = useState<Vec2 | null>(null);
  const [bestDistance, setBestDistance] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [milestoneToast, setMilestoneToast] = useState<{ text: string; startedAt: number } | null>(null);
  const [assistCallout, setAssistCallout] = useState<{ text: string; pos: Vec2; positive: boolean; startedAt: number } | null>(null);

  const shipPos = useRef<Vec2>({ ...LAUNCH_PAD });
  const shipVel = useRef<Vec2>({ x: 0, y: 0 });
  const simTime = useRef(0);
  const trail = useRef<Vec2[]>([]);
  const bodiesRef = useRef<BodyState[]>(computeBodies(0));
  const crashBody = useRef<BodyState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const maxDistReached = useRef(vLen(LAUNCH_PAD));
  const firedMilestones = useRef<Set<number>>(new Set());
  const bestDistanceRef = useRef(0);
  const toastExpiryRef = useRef(0);
  const cameraCenter = useRef<Vec2>({ x: 0, y: 0 });
  const burnsRef = useRef(BURN_CHARGES);
  const [burnsRemaining, setBurnsRemaining] = useState(BURN_CHARGES);
  const ffRafRef = useRef<number | null>(null);
  const flybyRef = useRef<{ bodyId: string; enterSpeed: number } | null>(null);
  const assistExpiryRef = useRef(0);

  useEffect(() => {
    loadBestDistance().then((d) => {
      setBestDistance(d);
      bestDistanceRef.current = d;
    });
  }, []);

  const baselineScale = BOARD_SIZE / (2 * VIEW_RADIUS);
  const overviewScale = BOARD_SIZE / (2 * OVERVIEW_RADIUS);
  const cameraScale = useRef(overviewScale);
  const introRafRef = useRef<number | null>(null);

  const stopIntroZoom = useCallback(() => {
    if (introRafRef.current != null) cancelAnimationFrame(introRafRef.current);
    introRafRef.current = null;
  }, []);

  const snapToAimScale = useCallback(() => {
    stopIntroZoom();
    cameraScale.current = baselineScale;
    setRenderTick((n) => n + 1);
  }, [stopIntroZoom, baselineScale]);

  const startIntroZoom = useCallback(() => {
    stopIntroZoom();
    cameraScale.current = overviewScale;
    const startTs = performance.now();
    const step = (ts: number) => {
      const t = Math.min((ts - startTs) / INTRO_ZOOM_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      cameraScale.current = overviewScale + (baselineScale - overviewScale) * eased;
      setRenderTick((n) => n + 1);
      introRafRef.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    introRafRef.current = requestAnimationFrame(step);
  }, [stopIntroZoom, baselineScale, overviewScale]);

  // Runs once on mount — intentionally not re-triggered by startIntroZoom
  // identity changes, since baselineScale/overviewScale never change after
  // BOARD_SIZE is fixed at module load.
  useEffect(() => {
    startIntroZoom();
    return stopIntroZoom;
  }, [startIntroZoom, stopIntroZoom]);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
  }, []);

  const updateCamera = useCallback((shipDist: number, shipPosNow: Vec2) => {
    const targetRadius = Math.max(VIEW_RADIUS, shipDist * 1.35);
    const targetScale = BOARD_SIZE / (2 * targetRadius);
    cameraScale.current += (targetScale - cameraScale.current) * 0.07;

    const followT = Math.max(0, Math.min(1, (shipDist - FOLLOW_START_DIST) / (FOLLOW_FULL_DIST - FOLLOW_START_DIST)));
    const targetCenter = { x: shipPosNow.x * followT, y: shipPosNow.y * followT };
    cameraCenter.current = {
      x: cameraCenter.current.x + (targetCenter.x - cameraCenter.current.x) * 0.05,
      y: cameraCenter.current.y + (targetCenter.y - cameraCenter.current.y) * 0.05,
    };
  }, []);

  const tick = useCallback((ts: number) => {
    if (lastTsRef.current == null) lastTsRef.current = ts;
    const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
    lastTsRef.current = ts;

    const result = integrateShip(shipPos.current, shipVel.current, simTime.current, dt);
    shipPos.current = result.pos;
    shipVel.current = result.vel;
    simTime.current = result.t;
    bodiesRef.current = computeBodies(simTime.current);

    trail.current.push({ ...result.pos });
    if (trail.current.length > TRAIL_LENGTH) trail.current.shift();

    const dist = vLen(result.pos);
    maxDistReached.current = Math.max(maxDistReached.current, dist);
    updateCamera(dist, result.pos);

    MILESTONES.forEach((m, i) => {
      if (maxDistReached.current >= m.distance && !firedMilestones.current.has(i)) {
        firedMilestones.current.add(i);
        toastExpiryRef.current = performance.now() + TOAST_DURATION_MS;
        setMilestoneToast({ text: m.label, startedAt: performance.now() });
      }
    });
    if (toastExpiryRef.current && performance.now() > toastExpiryRef.current) {
      toastExpiryRef.current = 0;
      setMilestoneToast(null);
    }

    // Assist feedback: find the closest body whose "safe" ring the ship is
    // currently inside (if any), and report the net speed change the
    // instant that flyby ends.
    let insideBody: BodyState | null = null;
    let insideDist = Infinity;
    for (const b of bodiesRef.current) {
      const d = vLen(vSub(b.pos, result.pos));
      if (d <= riskRadii(b).safe && d < insideDist) {
        insideBody = b;
        insideDist = d;
      }
    }
    const nowSpeed = vLen(result.vel);
    const reportFlybyEnd = (bodyId: string, enterSpeed: number) => {
      const delta = nowSpeed - enterSpeed;
      if (Math.abs(delta) >= ASSIST_MIN_DELTA) {
        const sign = delta >= 0 ? '+' : '';
        assistExpiryRef.current = performance.now() + ASSIST_CALLOUT_MS;
        setAssistCallout({
          text: `${sign}${delta.toFixed(0)} — ${bodyDisplayName(bodyId)} assist`,
          pos: { ...result.pos },
          positive: delta >= 0,
          startedAt: performance.now(),
        });
      }
    };
    if (insideBody) {
      if (!flybyRef.current) {
        flybyRef.current = { bodyId: insideBody.id, enterSpeed: nowSpeed };
      } else if (flybyRef.current.bodyId !== insideBody.id) {
        // Zones overlap (e.g. the Sun's is bigger than the launch pad's own
        // distance from it) — report the body we're leaving before we
        // start tracking the new one, instead of silently dropping it.
        reportFlybyEnd(flybyRef.current.bodyId, flybyRef.current.enterSpeed);
        flybyRef.current = { bodyId: insideBody.id, enterSpeed: nowSpeed };
      }
    } else if (flybyRef.current) {
      reportFlybyEnd(flybyRef.current.bodyId, flybyRef.current.enterSpeed);
      flybyRef.current = null;
    }
    if (assistExpiryRef.current && performance.now() > assistExpiryRef.current) {
      assistExpiryRef.current = 0;
      setAssistCallout(null);
    }

    const finishRun = () => {
      if (maxDistReached.current > bestDistanceRef.current) {
        bestDistanceRef.current = maxDistReached.current;
        setBestDistance(maxDistReached.current);
        setIsNewRecord(true);
        saveBestDistance(maxDistReached.current);
      } else {
        setIsNewRecord(false);
      }
      setMilestoneToast(null);
      setAssistCallout(null);
    };

    if (result.collidedWith) {
      crashBody.current = result.collidedWith;
      finishRun();
      setPhase('crashed');
      stopLoop();
      setRenderTick((n) => n + 1);
      return;
    }
    if (dist > ESCAPE_RADIUS) {
      finishRun();
      setPhase('escaped');
      stopLoop();
      setRenderTick((n) => n + 1);
      return;
    }

    setRenderTick((n) => n + 1);
    rafRef.current = requestAnimationFrame(tick);
  }, [stopLoop, updateCamera]);

  const launch = useCallback((dragVector: Vec2, factor: number) => {
    const dir = vLen(dragVector) > 0 ? { x: -dragVector.x / vLen(dragVector), y: -dragVector.y / vLen(dragVector) } : { x: 0, y: -1 };
    const launchVel = { x: dir.x * MAX_LAUNCH_SPEED * factor, y: dir.y * MAX_LAUNCH_SPEED * factor };
    shipPos.current = { ...LAUNCH_PAD };
    shipVel.current = launchVel;
    trail.current = [{ ...LAUNCH_PAD }];
    crashBody.current = null;
    maxDistReached.current = vLen(LAUNCH_PAD);
    firedMilestones.current = new Set();
    toastExpiryRef.current = 0;
    setMilestoneToast(null);
    setIsNewRecord(false);
    cameraCenter.current = { x: 0, y: 0 };
    burnsRef.current = BURN_CHARGES;
    setBurnsRemaining(BURN_CHARGES);
    flybyRef.current = null;
    assistExpiryRef.current = 0;
    setAssistCallout(null);
    setAimDrag(null);
    setPhase('flying');
    lastTsRef.current = null;
    stopIntroZoom();
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, stopIntroZoom]);

  const resetToAiming = useCallback(() => {
    stopLoop();
    shipPos.current = { ...LAUNCH_PAD };
    shipVel.current = { x: 0, y: 0 };
    trail.current = [];
    crashBody.current = null;
    maxDistReached.current = vLen(LAUNCH_PAD);
    firedMilestones.current = new Set();
    toastExpiryRef.current = 0;
    setMilestoneToast(null);
    cameraCenter.current = { x: 0, y: 0 };
    bodiesRef.current = computeBodies(simTime.current);
    setAimDrag(null);
    setPhase('aiming');
    startIntroZoom();
    setRenderTick((n) => n + 1);
  }, [stopLoop, startIntroZoom]);

  const stopFastForward = useCallback(() => {
    if (ffRafRef.current != null) cancelAnimationFrame(ffRafRef.current);
    ffRafRef.current = null;
  }, []);

  // Fast-forwards the planets' orbits (not the ship) so you can watch for a
  // good alignment before committing to a launch — a real launch-window
  // preview, not just a guess.
  const startFastForward = useCallback(() => {
    if (phase !== 'aiming') return;
    stopIntroZoom();
    cameraScale.current = baselineScale;
    stopFastForward();
    let lastTs: number | null = null;
    const step = (ts: number) => {
      if (lastTs == null) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05);
      lastTs = ts;
      simTime.current += dt * FAST_FORWARD_SPEED;
      bodiesRef.current = computeBodies(simTime.current);
      setRenderTick((n) => n + 1);
      ffRafRef.current = requestAnimationFrame(step);
    };
    ffRafRef.current = requestAnimationFrame(step);
  }, [phase, stopIntroZoom, baselineScale, stopFastForward]);

  // A limited prograde correction burn: one aim isn't the whole plan, you
  // can nudge the ship once you see how the first leg is actually going.
  const applyBurn = useCallback(() => {
    if (phase !== 'flying' || burnsRef.current <= 0) return;
    const v = shipVel.current;
    const spd = vLen(v);
    if (spd > 0.01) {
      const dir = { x: v.x / spd, y: v.y / spd };
      shipVel.current = { x: v.x + dir.x * BURN_DELTA_V, y: v.y + dir.y * BURN_DELTA_V };
    }
    burnsRef.current -= 1;
    setBurnsRemaining(burnsRef.current);
  }, [phase]);

  useEffect(() => stopFastForward, [stopFastForward]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phase !== 'flying',
        onMoveShouldSetPanResponder: () => phase !== 'flying',
        onPanResponderGrant: () => {
          if (phase !== 'aiming' && phase !== 'flying') {
            resetToAiming();
            return;
          }
          if (phase === 'aiming') {
            // Touching down to actually aim ends the wide overview (and any
            // launch-window preview in progress) and commits to the tight,
            // precisely-tuned drag scale.
            stopFastForward();
            snapToAimScale();
          }
        },
        onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (phase !== 'aiming') return;
          const raw = screenDeltaToWorld(gesture.dx, gesture.dy, cameraScale.current);
          const len = vLen(raw);
          const clamp = len > MAX_DRAG_VISUAL ? MAX_DRAG_VISUAL / len : 1;
          setAimDrag({ x: raw.x * clamp, y: raw.y * clamp });
        },
        onPanResponderRelease: () => {
          if (phase !== 'aiming') return;
          setAimDrag((current) => {
            const len = current ? vLen(current) : 0;
            if (current && len > 6) {
              const factor = Math.tanh(len / DRAG_SOFTNESS);
              launch(current, factor);
            }
            return null;
          });
        },
      }),
    [phase, launch, resetToAiming, snapToAimScale, stopFastForward]
  );

  const scale = cameraScale.current;
  const center = cameraCenter.current;
  const originScreen = toScreen({ x: 0, y: 0 }, scale, center);
  const shipScreen = toScreen(shipPos.current, scale, center);
  const speed = vLen(shipVel.current);
  const escapeSpeedHere = localEscapeSpeed(vLen(shipPos.current));
  const heading = Math.atan2(shipVel.current.y, shipVel.current.x);
  const shipTipAngle = phase === 'aiming' && aimDrag ? Math.atan2(-aimDrag.y, -aimDrag.x) : heading;

  const trailPoints = trail.current.map((p) => {
    const s = toScreen(p, scale, center);
    return `${s.x},${s.y}`;
  }).join(' ');

  const assistElapsed = assistCallout ? performance.now() - assistCallout.startedAt : 0;
  const assistProgress = Math.min(1, assistElapsed / ASSIST_CALLOUT_MS);
  const assistOpacity = assistCallout ? 1 - assistProgress : 0;
  const assistScreen = assistCallout ? toScreen(assistCallout.pos, scale, center) : null;

  const launchScreen = toScreen(LAUNCH_PAD, scale, center);
  const dragLen = aimDrag ? vLen(aimDrag) : 0;
  const powerFactor = Math.tanh(dragLen / DRAG_SOFTNESS);
  const aimEnd = aimDrag ? toScreen({ x: LAUNCH_PAD.x + aimDrag.x, y: LAUNCH_PAD.y + aimDrag.y }, scale, center) : null;

  // Ghost markers: where each planet will actually be a bit from now, at
  // this same (fast-forwardable) sim time — a visual aid for leading a
  // distant target instead of memorizing its orbital speed.
  const ghostMarkers = phase === 'aiming'
    ? PLANETS.map((p) => ({
        id: p.id,
        color: p.color,
        from: toScreen(planetPosition(p, simTime.current), scale, center),
        to: toScreen(planetPosition(p, simTime.current + GHOST_LEAD_SECONDS), scale, center),
      }))
    : [];

  const bandPath = useMemo(() => {
    if (!aimDrag || !aimEnd) return null;
    const mid = { x: (launchScreen.x + aimEnd.x) / 2, y: (launchScreen.y + aimEnd.y) / 2 };
    const perp = { x: -(aimEnd.y - launchScreen.y), y: aimEnd.x - launchScreen.x };
    const perpLen = Math.hypot(perp.x, perp.y) || 1;
    const sag = Math.min(dragLen * 0.1, 22);
    const ctrl = { x: mid.x + (perp.x / perpLen) * sag, y: mid.y + (perp.y / perpLen) * sag };
    return `M ${launchScreen.x} ${launchScreen.y} Q ${ctrl.x} ${ctrl.y} ${aimEnd.x} ${aimEnd.y}`;
  }, [aimDrag, aimEnd, launchScreen.x, launchScreen.y, dragLen]);

  // Fuzzy near-term preview: simulate the actual candidate launch forward a
  // short, fixed horizon using real (moving) planet positions. Deliberately
  // cut short — it teaches "where will the planet be", not the whole flight.
  const previewPoints = useMemo(() => {
    if (phase !== 'aiming' || !aimDrag) return null;
    const len = vLen(aimDrag);
    if (len <= 6) return null;
    const factor = Math.tanh(len / DRAG_SOFTNESS);
    const dir = { x: -aimDrag.x / len, y: -aimDrag.y / len };
    let pos = { ...LAUNCH_PAD };
    let vel = { x: dir.x * MAX_LAUNCH_SPEED * factor, y: dir.y * MAX_LAUNCH_SPEED * factor };
    let t = simTime.current;
    const points: Vec2[] = [pos];
    const steps = Math.round(PREVIEW_SECONDS / PREVIEW_DT);
    for (let i = 0; i < steps; i++) {
      const result = integrateShip(pos, vel, t, PREVIEW_DT, 2);
      pos = result.pos;
      vel = result.vel;
      t = result.t;
      points.push(pos);
      if (result.collidedWith) break;
    }
    return points;
  }, [phase, aimDrag]);

  const previewSegments = useMemo(() => {
    if (!previewPoints || previewPoints.length < 2) return [];
    const chunkCount = 4;
    const chunkSize = Math.ceil(previewPoints.length / chunkCount);
    const segments: { points: string; opacity: number }[] = [];
    for (let c = 0; c < chunkCount; c++) {
      const start = Math.max(0, c * chunkSize - 1);
      const end = Math.min(previewPoints.length, (c + 1) * chunkSize);
      if (end - start < 2) continue;
      const slice = previewPoints.slice(start, end);
      const pts = slice.map((p) => {
        const s = toScreen(p, scale, center);
        return `${s.x},${s.y}`;
      }).join(' ');
      segments.push({ points: pts, opacity: 0.5 - c * 0.1 });
    }
    return segments;
  }, [previewPoints, scale, center]);

  const distanceRings = useMemo(() => {
    const rings: number[] = [];
    for (let r = DISTANCE_RING_STEP; r * scale < BOARD_SIZE * 0.75; r += DISTANCE_RING_STEP) {
      rings.push(r);
    }
    return rings;
  }, [scale]);

  const shipRotationDeg = (shipTipAngle * 180) / Math.PI;
  const flameLength = Math.min(1.1, 0.4 + speed / 260);

  return (
    <View style={styles.fill}>
      <View style={styles.center} {...panResponder.panHandlers}>
        <View style={styles.hud}>
          <Text style={styles.hudTitle}>Voyager</Text>
          <Text style={styles.hudSub}>
            dist {vLen(shipPos.current).toFixed(0)} / {ESCAPE_RADIUS} · best {bestDistance.toFixed(0)}
          </Text>
          <Text style={[styles.hudSub, speed >= escapeSpeedHere ? styles.hudGood : styles.hudBad]}>
            speed {speed.toFixed(0)} · escape needs {escapeSpeedHere.toFixed(0)}
            {phase === 'flying' ? ` · burns ${burnsRemaining}` : ''}
          </Text>
        </View>

        {milestoneToast && (
          <View pointerEvents="none" style={styles.toast}>
            <Text style={styles.toastText}>{milestoneToast.text}</Text>
          </View>
        )}

        <Svg width={BOARD_SIZE} height={BOARD_SIZE}>
          <Defs>
            <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#fff3c4" stopOpacity={0.95} />
              <Stop offset="35%" stopColor="#ffd166" stopOpacity={0.5} />
              <Stop offset="100%" stopColor="#ffd166" stopOpacity={0} />
            </RadialGradient>
            {PLANETS.map((p) => (
              <RadialGradient key={`glow-${p.id}`} id={`glow-${p.id}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={p.color} stopOpacity={0.65} />
                <Stop offset="100%" stopColor={p.color} stopOpacity={0} />
              </RadialGradient>
            ))}
            <LinearGradient id="shipHull" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#f6f8ff" />
              <Stop offset="100%" stopColor="#8ea2c9" />
            </LinearGradient>
            <LinearGradient id="shipFlame" x1="0%" y1="50%" x2="100%" y2="50%">
              <Stop offset="0%" stopColor="#ff6b3d" stopOpacity={0} />
              <Stop offset="100%" stopColor="#ffcf6b" stopOpacity={0.95} />
            </LinearGradient>
          </Defs>

          {STARS.map((s, i) => (
            <Circle key={i} cx={s.x * BOARD_SIZE} cy={s.y * BOARD_SIZE} r={s.r} fill="#e8e4ff" opacity={s.o} />
          ))}

          {distanceRings.map((r) => (
            <Ellipse key={r} cx={originScreen.x} cy={originScreen.y} rx={r * scale} ry={r * scale * TILT} stroke="#1c1638" strokeWidth={1} fill="none" />
          ))}

          {PLANETS.map((p) => (
            <Ellipse
              key={`orbit-${p.id}`}
              cx={originScreen.x}
              cy={originScreen.y}
              rx={p.orbitRadius * scale}
              ry={p.orbitRadius * scale * TILT}
              stroke="#2c2156"
              strokeWidth={1}
              fill="none"
            />
          ))}

          {phase === 'flying' && trail.current.length > 1 && (
            <Polyline points={trailPoints} stroke="#4ade80" strokeWidth={1.5} fill="none" opacity={0.5} />
          )}

          {phase === 'aiming' && ghostMarkers.map((g) => (
            <React.Fragment key={`ghost-${g.id}`}>
              <Line x1={g.from.x} y1={g.from.y} x2={g.to.x} y2={g.to.y} stroke={g.color} strokeWidth={1} strokeDasharray="1,4" opacity={0.4} />
              <Circle cx={g.to.x} cy={g.to.y} r={3.5} stroke={g.color} strokeWidth={1.3} strokeDasharray="2,2" fill="none" opacity={0.75} />
            </React.Fragment>
          ))}

          {phase === 'aiming' && bodiesRef.current.map((b) => {
            const s = toScreen(b.pos, scale, center);
            const risk = riskRadii(b);
            return (
              <React.Fragment key={`risk-${b.id}`}>
                <Ellipse cx={s.x} cy={s.y} rx={risk.safe * scale} ry={risk.safe * scale * TILT} stroke="#4ade80" strokeWidth={1} strokeOpacity={0.35} fill="none" />
                <Ellipse cx={s.x} cy={s.y} rx={risk.highRisk * scale} ry={risk.highRisk * scale * TILT} stroke="#ffd166" strokeWidth={1} strokeOpacity={0.4} fill="none" />
                <Ellipse cx={s.x} cy={s.y} rx={risk.crash * scale} ry={risk.crash * scale * TILT} stroke="#ff4d6d" strokeWidth={1.2} strokeOpacity={0.6} fill="none" />
              </React.Fragment>
            );
          })}

          {previewSegments.map((seg, i) => (
            <Polyline key={i} points={seg.points} stroke="#c9d6ff" strokeWidth={1.5} strokeDasharray="2,5" fill="none" opacity={seg.opacity} />
          ))}

          {bodiesRef.current.map((b) => {
            const s = toScreen(b.pos, scale, center);
            const r = Math.max(b.radius * scale, 2.5);
            const glowId = b.id === 'sun' ? 'sunGlow' : `glow-${b.id}`;
            return (
              <React.Fragment key={b.id}>
                <Circle cx={s.x} cy={s.y} r={r * 3.4} fill={`url(#${glowId})`} />
                <Circle cx={s.x} cy={s.y} r={r} fill={b.color} />
              </React.Fragment>
            );
          })}

          <Circle cx={launchScreen.x} cy={launchScreen.y} r={5} fill="#4ade80" opacity={phase === 'aiming' ? 1 : 0.3} />

          {phase === 'aiming' && aimDrag && bandPath && (
            <Path
              d={bandPath}
              stroke={`rgb(${255}, ${Math.round(159 - powerFactor * 60)}, ${Math.round(67 - powerFactor * 40)})`}
              strokeWidth={2 + powerFactor * 2.5}
              strokeLinecap="round"
              fill="none"
            />
          )}

          {(phase === 'flying' || phase === 'crashed') && (
            <G transform={`translate(${shipScreen.x} ${shipScreen.y}) rotate(${shipRotationDeg}) scale(${SHIP_RADIUS})`}>
              {phase === 'flying' && speed > 4 && (
                <Polygon
                  points={`-0.6,0.35 ${-(0.6 + flameLength)},0 -0.6,-0.35`}
                  fill="url(#shipFlame)"
                />
              )}
              <Polygon
                points="2.0,0 0.5,0.65 -1.3,1.05 -0.6,0 -1.3,-1.05 0.5,-0.65"
                fill={phase === 'crashed' ? '#ff4d6d' : 'url(#shipHull)'}
                stroke={phase === 'crashed' ? '#ffb3c1' : '#4a5a82'}
                strokeWidth={0.12}
              />
              {phase === 'flying' && <Circle cx={0.55} cy={0} r={0.3} fill="#2c3e6b" />}
            </G>
          )}

          {assistCallout && assistScreen && (
            <SvgText
              x={assistScreen.x}
              y={assistScreen.y - 16 - assistProgress * ASSIST_RISE_PX}
              fill={assistCallout.positive ? '#4ade80' : '#ff9f43'}
              fontSize={14}
              fontWeight="bold"
              textAnchor="middle"
              opacity={assistOpacity}
            >
              {assistCallout.text}
            </SvgText>
          )}
        </Svg>

        {phase === 'aiming' && (
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.hint}>Pull back from the green marker and let go</Text>
          </View>
        )}

        {phase === 'crashed' && (
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.bigMessage}>
              Lost {crashBody.current?.id === 'sun' ? 'in the Sun' : `at ${capitalize(crashBody.current?.id ?? '')}`}
            </Text>
            <Text style={styles.hint}>
              {isNewRecord ? `New best distance: ${maxDistReached.current.toFixed(0)}` : `Reached ${maxDistReached.current.toFixed(0)} · best ${bestDistance.toFixed(0)}`}
            </Text>
            <Text style={[styles.hint, styles.tapAgain]}>Tap to try again</Text>
          </View>
        )}

        {phase === 'escaped' && (
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.bigMessage}>Escape velocity reached</Text>
            <Text style={styles.hint}>
              {isNewRecord ? `New best distance: ${maxDistReached.current.toFixed(0)}` : `Reached ${maxDistReached.current.toFixed(0)} · best ${bestDistance.toFixed(0)}`}
            </Text>
            <Text style={[styles.hint, styles.tapAgain]}>Tap to try again</Text>
          </View>
        )}
      </View>

      {phase === 'aiming' && (
        <Pressable
          style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed]}
          onPressIn={startFastForward}
          onPressOut={stopFastForward}
        >
          <Text style={styles.controlButtonText}>⏩ Hold to preview orbits</Text>
        </Pressable>
      )}

      {phase === 'flying' && (
        <Pressable
          style={({ pressed }) => [
            styles.controlButton,
            burnsRemaining <= 0 && styles.controlButtonDisabled,
            pressed && burnsRemaining > 0 && styles.controlButtonPressed,
          ]}
          onPress={applyBurn}
          disabled={burnsRemaining <= 0}
        >
          <Text style={styles.controlButtonText}>🔥 Burn ({burnsRemaining})</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#05030d',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hud: {
    position: 'absolute',
    top: 48,
    alignItems: 'center',
  },
  hudTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  hudSub: {
    fontSize: 13,
    color: '#9b8fc4',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  hudGood: {
    color: '#4ade80',
  },
  hudBad: {
    color: '#ff9f43',
  },
  toast: {
    position: 'absolute',
    top: 118,
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 12, 46, 0.85)',
    borderColor: '#4ade80',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c9f7d9',
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: 70,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  bigMessage: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: '#9b8fc4',
    fontWeight: '600',
    textAlign: 'center',
  },
  tapAgain: {
    color: '#4ade80',
    marginTop: 6,
  },
  controlButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 12, 46, 0.9)',
    borderColor: '#4a5a82',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  controlButtonPressed: {
    backgroundColor: 'rgba(74, 90, 130, 0.9)',
  },
  controlButtonDisabled: {
    opacity: 0.4,
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8ff',
  },
});
