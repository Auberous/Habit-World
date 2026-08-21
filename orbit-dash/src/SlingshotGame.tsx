import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, View, type GestureResponderEvent, type PanResponderGestureState } from 'react-native';
import { PanResponder } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';
import {
  computeBodies,
  ESCAPE_RADIUS,
  integrateShip,
  LAUNCH_PAD,
  PLANETS,
  VIEW_RADIUS,
  vLen,
  vSub,
  type BodyState,
  type Vec2,
} from './orbitalPhysics';

type Phase = 'aiming' | 'flying' | 'crashed' | 'escaped';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOARD_SIZE = Math.min(SCREEN_W, SCREEN_H * 0.68);
const CENTER = BOARD_SIZE / 2;
const SCALE = BOARD_SIZE / (2 * VIEW_RADIUS);

const MAX_DRAG = 130; // world units
const POWER_SCALE = 2.4; // world-units/sec of launch speed per world-unit of pull-back
const TRAIL_LENGTH = 90;
const SHIP_RADIUS = 6;

function toScreen(p: Vec2): Vec2 {
  return { x: CENTER + p.x * SCALE, y: CENTER + p.y * SCALE };
}

function screenToWorld(x: number, y: number): Vec2 {
  return { x: (x - CENTER) / SCALE, y: (y - CENTER) / SCALE };
}

export default function SlingshotGame() {
  const [phase, setPhase] = useState<Phase>('aiming');
  const [renderTick, setRenderTick] = useState(0);
  const [aimDrag, setAimDrag] = useState<Vec2 | null>(null);

  const shipPos = useRef<Vec2>({ ...LAUNCH_PAD });
  const shipVel = useRef<Vec2>({ x: 0, y: 0 });
  const simTime = useRef(0);
  const trail = useRef<Vec2[]>([]);
  const bodiesRef = useRef<BodyState[]>(computeBodies(0));
  const crashBody = useRef<BodyState | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const boardOriginRef = useRef<Vec2>({ x: 0, y: 0 });

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTsRef.current = null;
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
  }, [stopLoop]);

  const launch = useCallback((dragVector: Vec2) => {
    const launchVel = { x: -dragVector.x * POWER_SCALE, y: -dragVector.y * POWER_SCALE };
    shipPos.current = { ...LAUNCH_PAD };
    shipVel.current = launchVel;
    trail.current = [{ ...LAUNCH_PAD }];
    crashBody.current = null;
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
    bodiesRef.current = computeBodies(simTime.current);
    setAimDrag(null);
    setPhase('aiming');
    setRenderTick((n) => n + 1);
  }, [stopLoop]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phase !== 'flying',
        onMoveShouldSetPanResponder: () => phase !== 'flying',
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          if (phase === 'flying') return;
          if (phase !== 'aiming') {
            resetToAiming();
            return;
          }
          const { locationX, locationY } = evt.nativeEvent;
          const world = screenToWorld(locationX, locationY);
          boardOriginRef.current = world;
        },
        onPanResponderMove: (_evt: GestureResponderEvent, gesture: PanResponderGestureState) => {
          if (phase !== 'aiming') return;
          const dx = gesture.dx / SCALE;
          const dy = gesture.dy / SCALE;
          const len = Math.hypot(dx, dy);
          const clamped = len > MAX_DRAG ? MAX_DRAG / len : 1;
          setAimDrag({ x: dx * clamped, y: dy * clamped });
        },
        onPanResponderRelease: () => {
          if (phase !== 'aiming') return;
          setAimDrag((current) => {
            if (current && vLen(current) > 4) {
              launch(current);
            }
            return null;
          });
        },
      }),
    [phase, launch, resetToAiming]
  );

  const shipScreen = toScreen(shipPos.current);
  const speed = vLen(shipVel.current);
  const heading = Math.atan2(shipVel.current.y, shipVel.current.x);
  const shipTipAngle = phase === 'aiming' && aimDrag ? Math.atan2(-aimDrag.y, -aimDrag.x) : heading;

  const trailPoints = trail.current.map((p) => {
    const s = toScreen(p);
    return `${s.x},${s.y}`;
  }).join(' ');

  const aimEnd = aimDrag ? toScreen({ x: LAUNCH_PAD.x + aimDrag.x, y: LAUNCH_PAD.y + aimDrag.y }) : null;
  const launchScreen = toScreen(LAUNCH_PAD);

  const shipTriangle = useMemo(() => {
    const p1 = { x: shipScreen.x + Math.cos(shipTipAngle) * SHIP_RADIUS * 1.8, y: shipScreen.y + Math.sin(shipTipAngle) * SHIP_RADIUS * 1.8 };
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
          <Text style={styles.hudTitle}>Slingshot</Text>
          <Text style={styles.hudSub}>speed {speed.toFixed(0)} · dist {vLen(shipPos.current).toFixed(0)}</Text>
        </View>

        <Svg width={BOARD_SIZE} height={BOARD_SIZE}>
          <Circle cx={CENTER} cy={CENTER} r={(VIEW_RADIUS) * SCALE} stroke="#241b45" strokeWidth={1} fill="none" />

          {PLANETS.map((p) => (
            <Circle
              key={`orbit-${p.id}`}
              cx={CENTER}
              cy={CENTER}
              r={p.orbitRadius * SCALE}
              stroke="#2c2156"
              strokeWidth={1}
              fill="none"
            />
          ))}

          {phase === 'flying' && trail.current.length > 1 && (
            <Polyline points={trailPoints} stroke="#4ade80" strokeWidth={1.5} fill="none" opacity={0.55} />
          )}

          {bodiesRef.current.map((b) => {
            const s = toScreen(b.pos);
            return <Circle key={b.id} cx={s.x} cy={s.y} r={Math.max(b.radius * SCALE, 3)} fill={b.color} />;
          })}

          <Circle cx={launchScreen.x} cy={launchScreen.y} r={5} fill="#4ade80" opacity={phase === 'aiming' ? 1 : 0.3} />

          {phase === 'aiming' && aimDrag && aimEnd && (
            <Line x1={launchScreen.x} y1={launchScreen.y} x2={aimEnd.x} y2={aimEnd.y} stroke="#ff9f43" strokeWidth={2} strokeDasharray="4,4" />
          )}

          {(phase === 'flying' || phase === 'crashed') && (
            <Polygon points={shipTriangle} fill={phase === 'crashed' ? '#ff4d6d' : '#e2e8ff'} />
          )}
        </Svg>

        {phase === 'aiming' && (
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.hint}>Drag back from the green dot and release to launch</Text>
          </View>
        )}

        {phase === 'crashed' && (
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.bigMessage}>Crashed into {crashBody.current?.id === 'sun' ? 'the Sun' : crashBody.current?.id}</Text>
            <Text style={styles.hint}>Tap to try again</Text>
          </View>
        )}

        {phase === 'escaped' && (
          <View pointerEvents="none" style={styles.overlay}>
            <Text style={styles.bigMessage}>Escaped the system!</Text>
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
    backgroundColor: '#0a0618',
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
    letterSpacing: 1,
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
