import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { PanResponder } from 'react-native';
import Svg, { Circle, Defs, Ellipse, Path, Polygon, Polyline, RadialGradient, Stop } from 'react-native-svg';
import {
  computeBodies,
  ESCAPE_RADIUS,
  integrateShip,
  LAUNCH_PAD,
  PLANETS,
  VIEW_RADIUS,
  vLen,
  type BodyState,
  type Vec2,
} from './orbitalPhysics';
import { generateStars } from './starfield';

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
const DISTANCE_RING_STEP = 260;

const STARS = generateStars(160);

function toScreen(p: Vec2, scale: number): Vec2 {
  return { x: CENTER + p.x * scale, y: CENTER + p.y * scale * TILT };
}

function screenDeltaToWorld(dx: number, dy: number, scale: number): Vec2 {
  return { x: dx / scale, y: dy / (scale * TILT) };
}

export default function SlingshotGame() {
  const [phase, setPhase] = useState<Phase>('aiming');
  const [, setRenderTick] = useState(0);
  const [aimDrag, setAimDrag] = useState<Vec2 | null>(null);

  const shipPos = useRef<Vec2>({ ...LAUNCH_PAD });
  const shipVel = useRef<Vec2>({ x: 0, y: 0 });
  const simTime = useRef(0);
  const trail = useRef<Vec2[]>([]);
  const bodiesRef = useRef<BodyState[]>(computeBodies(0));
  const crashBody = useRef<BodyState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const maxDistReached = useRef(vLen(LAUNCH_PAD));

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

    if (result.collidedWith) {
      crashBody.current = result.collidedWith;
      setPhase('crashed');
      stopLoop();
      setRenderTick((n) => n + 1);
      return;
    }
    if (dist > ESCAPE_RADIUS) {
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
          <Text style={styles.hudSub}>speed {speed.toFixed(0)} · dist {vLen(shipPos.current).toFixed(0)} / {ESCAPE_RADIUS}</Text>
        </View>

        <Svg width={BOARD_SIZE} height={BOARD_SIZE}>
          <Defs>
            <RadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#fff3c4" stopOpacity={0.95} />
              <Stop offset="35%" stopColor="#ffd166" stopOpacity={0.5} />
              <Stop offset="100%" stopColor="#ffd166" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#8ecae6" stopOpacity={0.7} />
              <Stop offset="100%" stopColor="#8ecae6" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="outerGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ff8fa3" stopOpacity={0.7} />
              <Stop offset="100%" stopColor="#ff8fa3" stopOpacity={0} />
            </RadialGradient>
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

          {bodiesRef.current.map((b) => {
            const s = toScreen(b.pos, scale);
            const r = Math.max(b.radius * scale, 2.5);
            const glowId = b.id === 'sun' ? 'sunGlow' : b.id === 'inner' ? 'innerGlow' : 'outerGlow';
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
            <Text style={styles.bigMessage}>Lost in {crashBody.current?.id === 'sun' ? 'the Sun' : `the ${crashBody.current?.id} flyby`}</Text>
            <Text style={styles.hint}>Tap to try again</Text>
          </View>
        )}

        {phase === 'escaped' && (
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.bigMessage}>Escape velocity reached</Text>
            <Text style={styles.hint}>Tap to try again</Text>
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
    color: '#4ade80',
    fontWeight: '600',
    textAlign: 'center',
  },
});
