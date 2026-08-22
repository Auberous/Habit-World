import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { PanResponder } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, Polygon, Polyline, RadialGradient, Stop } from 'react-native-svg';
import {
  computeBodies,
  ESCAPE_RADIUS,
  integrateShip,
  LAUNCH_PAD,
  localEscapeSpeed,
  MILESTONES,
  PLANETS,
  riskRadii,
  VIEW_RADIUS,
  vLen,
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

// The trajectory preview only looks this far ahead — a fuzzy near-term read,
// not a solved answer. Anything beyond it (later flybys, the actual escape)
// still has to be learned by flying it.
const PREVIEW_SECONDS = 2.6;
const PREVIEW_DT = 1 / 20;

const STARS = generateStars(160);

function toScreen(p: Vec2, scale: number): Vec2 {
  return { x: CENTER + p.x * scale, y: CENTER + p.y * scale * TILT };
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

  useEffect(() => {
    loadBestDistance().then((d) => {
      setBestDistance(d);
      bestDistanceRef.current = d;
    });
  }, []);

  const baselineScale = BOARD_SIZE / (2 * VIEW_RADIUS);
  const cameraScale = useRef(baselineScale);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
  }, []);

  const updateCamera = useCallback((shipDist: number) => {
    const targetRadius = Math.max(VIEW_RADIUS, shipDist * 1.35);
    const targetScale = BOARD_SIZE / (2 * targetRadius);
    cameraScale.current += (targetScale - cameraScale.current) * 0.07;
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
    updateCamera(dist);

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
    setAimDrag(null);
    setPhase('flying');
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

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
    cameraScale.current = baselineScale;
    bodiesRef.current = computeBodies(simTime.current);
    setAimDrag(null);
    setPhase('aiming');
    setRenderTick((n) => n + 1);
  }, [stopLoop, baselineScale]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phase !== 'flying',
        onMoveShouldSetPanResponder: () => phase !== 'flying',
        onPanResponderGrant: () => {
          if (phase !== 'aiming' && phase !== 'flying') {
            resetToAiming();
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
    [phase, launch, resetToAiming]
  );

  const scale = cameraScale.current;
  const shipScreen = toScreen(shipPos.current, scale);
  const speed = vLen(shipVel.current);
  const escapeSpeedHere = localEscapeSpeed(vLen(shipPos.current));
  const heading = Math.atan2(shipVel.current.y, shipVel.current.x);
  const shipTipAngle = phase === 'aiming' && aimDrag ? Math.atan2(-aimDrag.y, -aimDrag.x) : heading;

  const trailPoints = trail.current.map((p) => {
    const s = toScreen(p, scale);
    return `${s.x},${s.y}`;
  }).join(' ');

  const launchScreen = toScreen(LAUNCH_PAD, scale);
  const dragLen = aimDrag ? vLen(aimDrag) : 0;
  const powerFactor = Math.tanh(dragLen / DRAG_SOFTNESS);
  const aimEnd = aimDrag ? toScreen({ x: LAUNCH_PAD.x + aimDrag.x, y: LAUNCH_PAD.y + aimDrag.y }, scale) : null;

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
        const s = toScreen(p, scale);
        return `${s.x},${s.y}`;
      }).join(' ');
      segments.push({ points: pts, opacity: 0.5 - c * 0.1 });
    }
    return segments;
  }, [previewPoints, scale]);

  const distanceRings = useMemo(() => {
    const rings: number[] = [];
    for (let r = DISTANCE_RING_STEP; r * scale < BOARD_SIZE * 0.75; r += DISTANCE_RING_STEP) {
      rings.push(r);
    }
    return rings;
  }, [scale]);

  const shipTriangle = useMemo(() => {
    const p1 = { x: shipScreen.x + Math.cos(shipTipAngle) * SHIP_RADIUS * 1.9, y: shipScreen.y + Math.sin(shipTipAngle) * SHIP_RADIUS * 1.9 };
    const p2 = {
      x: shipScreen.x + Math.cos(shipTipAngle + 2.5) * SHIP_RADIUS,
      y: shipScreen.y + Math.sin(shipTipAngle + 2.5) * SHIP_RADIUS,
    };
    const p3 = {
      x: shipScreen.x + Math.cos(shipTipAngle - 2.5) * SHIP_RADIUS,
      y: shipScreen.y + Math.sin(shipTipAngle - 2.5) * SHIP_RADIUS,
    };
    return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`;
  }, [shipScreen.x, shipScreen.y, shipTipAngle]);

  return (
    <View style={styles.fill} {...panResponder.panHandlers}>
      <View style={styles.center}>
        <View style={styles.hud}>
          <Text style={styles.hudTitle}>Voyager</Text>
          <Text style={styles.hudSub}>
            dist {vLen(shipPos.current).toFixed(0)} / {ESCAPE_RADIUS} · best {bestDistance.toFixed(0)}
          </Text>
          <Text style={[styles.hudSub, speed >= escapeSpeedHere ? styles.hudGood : styles.hudBad]}>
            speed {speed.toFixed(0)} · escape needs {escapeSpeedHere.toFixed(0)}
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
          </Defs>

          {STARS.map((s, i) => (
            <Circle key={i} cx={s.x * BOARD_SIZE} cy={s.y * BOARD_SIZE} r={s.r} fill="#e8e4ff" opacity={s.o} />
          ))}

          {distanceRings.map((r) => (
            <Ellipse key={r} cx={CENTER} cy={CENTER} rx={r * scale} ry={r * scale * TILT} stroke="#1c1638" strokeWidth={1} fill="none" />
          ))}

          {PLANETS.map((p) => (
            <Ellipse
              key={`orbit-${p.id}`}
              cx={CENTER}
              cy={CENTER}
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

          {phase === 'aiming' && bodiesRef.current.map((b) => {
            const s = toScreen(b.pos, scale);
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
            const s = toScreen(b.pos, scale);
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
            <Polygon points={shipTriangle} fill={phase === 'crashed' ? '#ff4d6d' : '#e2e8ff'} />
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
});
