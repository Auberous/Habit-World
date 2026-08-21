import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { describeArc, normalizeAngle, polarToCartesian } from './geometry';
import { loadBestScore, saveBestScore } from './storage';

type Lane = 'inner' | 'outer';
type Phase = 'ready' | 'playing' | 'gameover';

type Obstacle = {
  id: number;
  angle: number; // absolute, monotonically increasing — not wrapped
  lane: Lane;
  scored: boolean;
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BOARD_SIZE = Math.min(SCREEN_W, SCREEN_H * 0.62);
const CENTER = BOARD_SIZE / 2;
const OUTER_R = BOARD_SIZE * 0.42;
const INNER_R = BOARD_SIZE * 0.27;
const HUB_R = BOARD_SIZE * 0.08;
const PLAYER_DOT_R = 10;
const OBSTACLE_HALF_WIDTH = 0.26; // radians
const MIN_GAP = 1.15;
const MAX_GAP = 1.85;
const SPAWN_LOOKAHEAD = 5; // radians ahead of the player to keep obstacles queued
const BASE_ANGULAR_SPEED = 1.15; // rad/s
const MAX_ANGULAR_SPEED = 2.6;
const SPEED_RAMP_PER_POINT = 0.02;

function laneRadius(lane: Lane): number {
  return lane === 'inner' ? INNER_R : OUTER_R;
}

let obstacleId = 0;
function makeObstacle(angle: number): Obstacle {
  return {
    id: obstacleId++,
    angle,
    lane: Math.random() < 0.5 ? 'inner' : 'outer',
    scored: false,
  };
}

function seedObstacles(fromAngle: number): Obstacle[] {
  const list: Obstacle[] = [];
  let angle = fromAngle + 2.2;
  while (angle < fromAngle + SPAWN_LOOKAHEAD) {
    list.push(makeObstacle(angle));
    angle += MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
  }
  return list;
}

export default function Game() {
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [lane, setLane] = useState<Lane>('inner');
  const [playerAngle, setPlayerAngle] = useState(-Math.PI / 2); // start at top
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);

  const laneRef = useRef<Lane>('inner');
  const playerAngleRef = useRef(playerAngle);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const scoreRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    loadBestScore().then(setBest);
  }, []);

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTsRef.current = null;
  }, []);

  const endGame = useCallback(() => {
    stopLoop();
    setPhase('gameover');
    const finalScore = scoreRef.current;
    setBest((prevBest) => {
      if (finalScore > prevBest) {
        saveBestScore(finalScore);
        return finalScore;
      }
      return prevBest;
    });
  }, [stopLoop]);

  const tick = useCallback(
    (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.05);
      lastTsRef.current = ts;

      const speed = Math.min(
        BASE_ANGULAR_SPEED + scoreRef.current * SPEED_RAMP_PER_POINT,
        MAX_ANGULAR_SPEED
      );
      const nextAngle = playerAngleRef.current + speed * dt;
      playerAngleRef.current = nextAngle;

      let collided = false;
      const currentLane = laneRef.current;
      const nextObstacles = obstaclesRef.current
        .map((o) => {
          const delta = nextAngle - o.angle;
          if (Math.abs(delta) <= OBSTACLE_HALF_WIDTH) {
            if (o.lane === currentLane) {
              collided = true;
            }
          } else if (delta > OBSTACLE_HALF_WIDTH && !o.scored) {
            scoreRef.current += 1;
            return { ...o, scored: true };
          }
          return o;
        })
        .filter((o) => nextAngle - o.angle < SPAWN_LOOKAHEAD + 1);

      const last = nextObstacles[nextObstacles.length - 1];
      let lastAngle = last ? last.angle : nextAngle + 2.2;
      while (lastAngle < nextAngle + SPAWN_LOOKAHEAD) {
        lastAngle += MIN_GAP + Math.random() * (MAX_GAP - MIN_GAP);
        nextObstacles.push(makeObstacle(lastAngle));
      }

      obstaclesRef.current = nextObstacles;
      setPlayerAngle(nextAngle);
      setObstacles(nextObstacles);
      setScore(scoreRef.current);

      if (collided) {
        endGame();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [endGame]
  );

  const startGame = useCallback(() => {
    const startAngle = -Math.PI / 2;
    laneRef.current = 'inner';
    playerAngleRef.current = startAngle;
    scoreRef.current = 0;
    const seeded = seedObstacles(startAngle);
    obstaclesRef.current = seeded;

    setLane('inner');
    setPlayerAngle(startAngle);
    setObstacles(seeded);
    setScore(0);
    setPhase('playing');
    lastTsRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => stopLoop, [stopLoop]);

  const handlePress = useCallback(() => {
    if (phase !== 'playing') {
      startGame();
      return;
    }
    const nextLane: Lane = laneRef.current === 'inner' ? 'outer' : 'inner';
    laneRef.current = nextLane;
    setLane(nextLane);
  }, [phase, startGame]);

  const playerPoint = polarToCartesian(CENTER, CENTER, laneRadius(lane), normalizeAngle(playerAngle));

  return (
    <Pressable style={styles.fill} onPress={handlePress}>
      <View style={styles.center}>
        <View style={styles.hud}>
          <Text style={styles.score}>{score}</Text>
          <Text style={styles.best}>best {best}</Text>
        </View>

        <Svg width={BOARD_SIZE} height={BOARD_SIZE}>
          <Circle cx={CENTER} cy={CENTER} r={OUTER_R} stroke="#3a2c66" strokeWidth={2} fill="none" />
          <Circle cx={CENTER} cy={CENTER} r={INNER_R} stroke="#3a2c66" strokeWidth={2} fill="none" />
          <Circle cx={CENTER} cy={CENTER} r={HUB_R} fill="#ff4d6d" />

          {obstacles.map((o) => (
            <Path
              key={o.id}
              d={describeArc(
                CENTER,
                CENTER,
                laneRadius(o.lane),
                normalizeAngle(o.angle - OBSTACLE_HALF_WIDTH),
                normalizeAngle(o.angle + OBSTACLE_HALF_WIDTH)
              )}
              stroke="#ff9f43"
              strokeWidth={8}
              strokeLinecap="round"
              fill="none"
            />
          ))}

          <Circle cx={playerPoint.x} cy={playerPoint.y} r={PLAYER_DOT_R} fill="#4ade80" />
        </Svg>

        {phase !== 'playing' && (
          <View style={styles.overlay}>
            <Text style={styles.title}>Orbit Dash</Text>
            {phase === 'gameover' && (
              <Text style={styles.subtitle}>
                Score {score} · Best {Math.max(score, best)}
              </Text>
            )}
            <Text style={styles.hint}>Tap to {phase === 'gameover' ? 'try again' : 'start'}</Text>
            <Text style={styles.hint2}>Tap anywhere to switch orbit and dodge the gates</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: '#140a2e',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hud: {
    position: 'absolute',
    top: 56,
    alignItems: 'center',
  },
  score: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
  },
  best: {
    fontSize: 14,
    color: '#9b8fc4',
    marginTop: 2,
  },
  overlay: {
    position: 'absolute',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#e0d9f5',
    marginBottom: 12,
  },
  hint: {
    fontSize: 16,
    color: '#4ade80',
    fontWeight: '600',
  },
  hint2: {
    fontSize: 13,
    color: '#9b8fc4',
    marginTop: 6,
    textAlign: 'center',
  },
});
