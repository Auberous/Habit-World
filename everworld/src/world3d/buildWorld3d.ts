// Phase 0+1 bootstrap for the Babylon.js world: camera/lighting/ground once,
// then a disposable "growth root" of placeholder primitives (boxes, cones,
// spheres) rebuilt from the same Levels data and the same growth thresholds
// as worldRenderer.ts (the 2D SVG renderer), so the two views agree on what
// a given world should contain. Real art (Kenney/Quaternius models, Rive
// characters, etc.) is a later phase — this phase proves camera, lighting,
// data wiring, and continuous per-frame animation end-to-end.
// Deep, per-module imports rather than the `@babylonjs/core` barrel — the
// barrel pulls in the whole engine (audio, physics stubs, GLTF, ~6.6MB
// before gzip) regardless of what's actually used. Importing each class
// from its own module lets Vite/Rollup tree-shake down to only what this
// file references, which matters a lot for "loads on a phone".
import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import '@babylonjs/core/Rendering/edgesRenderer'; // referenced transitively by capsule builder in some versions
import type { Levels } from '../habitData';

function mulberry(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function hexColor3(hex: string): Color3 {
  return Color3.FromHexString(hex);
}

function flatMat(scene: Scene, hex: string, emissive = false): StandardMaterial {
  const mat = new StandardMaterial(`mat_${hex}_${Math.random().toString(36).slice(2, 6)}`, scene);
  const c = hexColor3(hex);
  mat.diffuseColor = c;
  mat.specularColor = new Color3(0.04, 0.04, 0.04);
  if (emissive) mat.emissiveColor = c.scale(0.55);
  return mat;
}

// One shared per-frame update loop walks this list rather than each mesh
// registering its own observer — cheaper, and easy to reason about/clear.
type AnimKind = 'sway' | 'wander' | 'circle' | 'bob' | 'fall' | 'flow';
interface AnimatedEntry {
  mesh: Mesh;
  kind: AnimKind;
  phase: number;
  speed: number;
  base: Vector3;
  radius: number;
  radiusZ?: number;
  resetY?: number;
  path?: Vector3[];
  t?: number;
}

// Walks a polyline at parameter t (0..1), used by the 'flow' animation kind
// for river markers — cheap stand-in for an animated flow texture.
function pointOnPath(path: Vector3[], t: number): Vector3 {
  const clamped = Math.max(0, Math.min(1, t));
  const segCount = path.length - 1;
  const scaled = clamped * segCount;
  const segIndex = Math.min(segCount - 1, Math.floor(scaled));
  const localT = scaled - segIndex;
  return Vector3.Lerp(path[segIndex], path[segIndex + 1], localT);
}

export interface World3D {
  scene: Scene;
  camera: ArcRotateCamera;
  dispose(): void;
  setLevels(levels: Levels): void;
}

const GROUND_TONES = ['#4a4034', '#564a3a', '#5f5b3d', '#5d6b3e', '#5a7a3f', '#4f8f45'];
const SKY_TONES = ['#161a24', '#1c2534', '#2a3a4d', '#3f6a8c', '#5fa3c9', '#8fd0ee'];
const GREEN_TONES = ['#3b6d2b', '#488033', '#59993d', '#6bb249'];
const GREY_TONES = ['#7a746a', '#8c867a', '#9c968a'];
const RAINBOW = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'];

const GROUND_RADIUS = 34;

export function createWorld3D(canvas: HTMLCanvasElement): World3D {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);

  const camera = new ArcRotateCamera('camera', -Math.PI / 2, 1.05, 34, Vector3.Zero(), scene);
  camera.fov = 0.78;
  camera.lowerRadiusLimit = 20;
  camera.upperRadiusLimit = 60;
  camera.lowerBetaLimit = 0.6;
  camera.upperBetaLimit = 1.3;
  camera.attachControl(canvas, true);

  const sun = new HemisphericLight('sun', new Vector3(0.3, 1, 0.2), scene);
  sun.intensity = 0.95;
  const fill = new DirectionalLight('fill', new Vector3(-0.4, -1, -0.3), scene);
  fill.intensity = 0.35;

  const ground = MeshBuilder.CreateGround('ground', { width: GROUND_RADIUS * 2.4, height: GROUND_RADIUS * 2.4, subdivisions: 4 }, scene);
  const groundMat = flatMat(scene, GROUND_TONES[0]);
  ground.material = groundMat;

  let growthRoot = new TransformNode('growthRoot', scene);
  let animated: AnimatedEntry[] = [];
  let currentLevels: Levels | null = null;

  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() / 1000;
    camera.alpha += 0.006 * dt; // slow idle orbit, same idea as the earlier prototype
    animated.forEach((a) => {
      a.phase += dt * a.speed;
      switch (a.kind) {
        case 'sway':
          a.mesh.rotation.z = Math.sin(a.phase) * 0.09;
          break;
        case 'wander':
          a.mesh.position.x = a.base.x + Math.cos(a.phase) * a.radius;
          a.mesh.position.z = a.base.z + Math.sin(a.phase * 0.8) * (a.radiusZ ?? a.radius);
          break;
        case 'circle':
          a.mesh.position.x = a.base.x + Math.cos(a.phase) * a.radius;
          a.mesh.position.z = a.base.z + Math.sin(a.phase) * a.radius;
          break;
        case 'bob':
          a.mesh.position.y = a.base.y + Math.abs(Math.sin(a.phase * 3)) * 0.35;
          break;
        case 'fall':
          a.mesh.position.y -= a.speed * dt;
          if (a.mesh.position.y < (a.resetY ?? 0)) a.mesh.position.y = a.base.y;
          break;
        case 'flow':
          if (a.path) {
            a.t = ((a.t ?? 0) + a.speed * dt) % 1;
            a.mesh.position.copyFrom(pointOnPath(a.path, a.t));
          }
          break;
      }
    });
  });

  function project(rnd: () => number, minR: number, maxR: number) {
    const angle = rnd() * Math.PI * 2;
    const r = minR + rnd() * (maxR - minR);
    return new Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
  }

  function buildGrowth(levels: Levels) {
    growthRoot.dispose();
    growthRoot = new TransformNode('growthRoot', scene);
    animated = [];

    const { blue, green, brown, grey, pink } = levels;
    const total = blue + green + brown + grey + pink;
    const mountainTier = total === 0 ? 0 : total < 6 ? 1 : total < 14 ? 2 : 3;

    groundMat.diffuseColor = hexColor3(GROUND_TONES[green]);
    scene.clearColor = hexColor3(SKY_TONES[blue]).toColor4(1);

    // Trees + bushes
    const greenRnd = mulberry(101);
    const treeTone = GREEN_TONES[Math.min(3, Math.floor(green / 2))];
    for (let i = 0; i < green * 3; i++) {
      const pos = project(greenRnd, 4, GROUND_RADIUS - 4);
      const bush = MeshBuilder.CreateSphere(`bush${i}`, { diameter: 0.9 + greenRnd() * 0.5, segments: 6 }, scene);
      bush.position = pos.add(new Vector3(0, 0.4, 0));
      bush.material = flatMat(scene, treeTone);
      bush.parent = growthRoot;
      animated.push({ mesh: bush, kind: 'sway', phase: greenRnd() * 10, speed: 0.5 + greenRnd() * 0.3, base: bush.position.clone(), radius: 0 });
    }
    const treeRnd = mulberry(205);
    for (let i = 0; i < green * 2; i++) {
      const pos = project(treeRnd, 4, GROUND_RADIUS - 4);
      const trunk = MeshBuilder.CreateCylinder(`trunk${i}`, { diameter: 0.3, height: 1.6 }, scene);
      trunk.position = pos.add(new Vector3(0, 0.8, 0));
      trunk.material = flatMat(scene, '#5d4037');
      trunk.parent = growthRoot;
      const top = MeshBuilder.CreateCylinder(`treetop${i}`, { diameterTop: 0, diameterBottom: 1.7, height: 2.3, tessellation: 6 }, scene);
      top.position.y = 1.6;
      top.material = flatMat(scene, treeTone);
      top.parent = trunk;
      animated.push({ mesh: top, kind: 'sway', phase: treeRnd() * 10, speed: 0.4 + treeRnd() * 0.3, base: top.position.clone(), radius: 0 });
    }

    // Village (brown)
    function hut(pos: Vector3, scale: number) {
      const base = MeshBuilder.CreateBox('hutBase', { width: 2.2 * scale, height: 1.2 * scale, depth: 2.2 * scale }, scene);
      base.position = pos.add(new Vector3(0, 0.6 * scale, 0));
      base.material = flatMat(scene, '#8a6a45');
      base.parent = growthRoot;
      const roof = MeshBuilder.CreateCylinder('hutRoof', { diameterTop: 0, diameterBottom: 2.8 * scale, height: 1.4 * scale, tessellation: 4 }, scene);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 1.2 * scale;
      roof.material = flatMat(scene, '#6b4e30');
      roof.parent = base;
      return base;
    }
    const villagePositions: Vector3[] = [];
    if (brown >= 1) villagePositions.push(new Vector3(-8, 0, 6));
    if (brown >= 2) villagePositions.push(new Vector3(-4, 0, 9));
    if (brown >= 4) villagePositions.push(new Vector3(-11, 0, 3), new Vector3(-2, 0, 4));
    villagePositions.forEach((p) => hut(p, 1));
    if (brown >= 3) {
      const statue = MeshBuilder.CreateCylinder('statue', { diameter: 0.8, height: 2.2 }, scene);
      statue.position = new Vector3(2, 1.1, 8);
      statue.material = flatMat(scene, '#b0a89b');
      statue.parent = growthRoot;
    }
    if (brown >= 5) {
      const monument = MeshBuilder.CreateBox('monument', { width: 6, height: 4, depth: 6 }, scene);
      monument.position = new Vector3(0, 2, 12);
      monument.material = flatMat(scene, '#8f7256');
      monument.parent = growthRoot;
    }

    // Villagers (grey) — the newest keeps "building" (fast bob) near the huts
    const greyBase = new Vector3(-6, 0, 6);
    for (let i = 0; i < grey; i++) {
      const body = MeshBuilder.CreateCapsule(`villager${i}`, { height: 1.4, radius: 0.28 }, scene);
      const pos = greyBase.add(new Vector3(i * 1.6 - grey * 0.5, 0.7, -2 - i));
      body.position = pos;
      body.material = flatMat(scene, GREY_TONES[i % 3]);
      body.parent = growthRoot;
      const building = brown >= 1 && i === grey - 1;
      animated.push(
        building
          ? { mesh: body, kind: 'bob', phase: i, speed: 3.2, base: pos.clone(), radius: 0 }
          : { mesh: body, kind: 'wander', phase: i * 2, speed: 0.3, base: pos.clone(), radius: 1.4, radiusZ: 0.8 }
      );
    }

    // Wildlife (pink, gated by green — same rule as the 2D renderer)
    const pinkRnd = mulberry(606);
    if (pink >= 1 && green >= 1) {
      for (let i = 0; i < pink; i++) {
        const bird = MeshBuilder.CreateSphere(`bird${i}`, { diameter: 0.28 }, scene);
        bird.material = flatMat(scene, '#e8a8c0', true);
        const center = new Vector3((pinkRnd() - 0.5) * 20, 4 + pinkRnd() * 3, (pinkRnd() - 0.5) * 20);
        bird.position = center.clone();
        bird.parent = growthRoot;
        animated.push({ mesh: bird, kind: 'circle', phase: pinkRnd() * 10, speed: 0.4 + pinkRnd() * 0.3, base: center, radius: 3 + pinkRnd() * 3 });
      }
    }
    if (pink >= 3 && green >= 2) {
      const fox = MeshBuilder.CreateBox('fox', { width: 1, height: 0.6, depth: 1.6 }, scene);
      const pos = new Vector3(-10, 0.4, -6);
      fox.position = pos;
      fox.material = flatMat(scene, '#d9773f');
      fox.parent = growthRoot;
      animated.push({ mesh: fox, kind: 'wander', phase: 0, speed: 0.4, base: pos, radius: 3, radiusZ: 2 });
    }
    if (pink >= 5 && green >= 4) {
      const deer = MeshBuilder.CreateBox('deer', { width: 1.1, height: 0.9, depth: 1.9 }, scene);
      const pos = new Vector3(10, 0.5, -8);
      deer.position = pos;
      deer.material = flatMat(scene, '#a97a52');
      deer.parent = growthRoot;
      animated.push({ mesh: deer, kind: 'wander', phase: 2, speed: 0.35, base: pos, radius: 4, radiusZ: 2.5 });
    }

    // River (blue >= 3): a chain of small flowing markers along a fixed
    // path stands in for animated flow texture, without needing any
    // external asset.
    if (blue >= 3) {
      const riverPts = [new Vector3(6, 0.02, -16), new Vector3(3, 0.02, -6), new Vector3(5, 0.02, 4), new Vector3(2, 0.02, 14)];
      const riverMat = flatMat(scene, '#2f6f93');
      for (let i = 0; i < riverPts.length - 1; i++) {
        const seg = MeshBuilder.CreateTube(`river${i}`, { path: [riverPts[i], riverPts[i + 1]], radius: 0.6 + (blue - 3) * 0.2, tessellation: 8 }, scene);
        seg.material = riverMat;
        seg.parent = growthRoot;
      }
      // Flow markers: small glowing spheres walking the river's polyline on
      // a loop, evenly spaced along it (t offsets) so the "current" reads
      // as continuous rather than one marker chasing an empty river.
      const flowMat = flatMat(scene, '#7fc4e0', true);
      const flowCount = 6;
      for (let i = 0; i < flowCount; i++) {
        const marker = MeshBuilder.CreateSphere(`flow${i}`, { diameter: 0.4 }, scene);
        marker.position = riverPts[0].add(new Vector3(0, 0.15, 0));
        marker.material = flowMat;
        marker.parent = growthRoot;
        animated.push({
          mesh: marker,
          kind: 'flow',
          phase: 0,
          speed: 0.09 + blue * 0.01,
          base: riverPts[0].clone(),
          radius: 0,
          path: riverPts.map((p) => p.add(new Vector3(0, 0.15, 0))),
          t: i / flowCount,
        });
      }

      // Waterfall once mountains are tall enough — cascading markers
      if (blue >= 4 && mountainTier >= 2) {
        const fallMat = flatMat(scene, '#bfe6f2', true);
        for (let i = 0; i < 5; i++) {
          const drop = MeshBuilder.CreateSphere(`fall${i}`, { diameter: 0.3 }, scene);
          drop.material = fallMat;
          drop.parent = growthRoot;
          const base = new Vector3(6, 8, -18);
          drop.position = base.add(new Vector3(0, -i * 1.6, 0));
          animated.push({ mesh: drop, kind: 'fall', phase: 0, speed: 4 + i, base, radius: 0, resetY: 0.5 });
        }
      }
    }

    // Mountains — a backdrop ring of cones scaling with overall vitality
    if (mountainTier > 0) {
      const mRnd = mulberry(501);
      const count = 10 + mountainTier * 3;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = GROUND_RADIUS + 6 + mRnd() * 6;
        const h = 6 + mountainTier * 5 * (0.6 + mRnd() * 0.6);
        const peak = MeshBuilder.CreateCylinder(`peak${i}`, { diameterTop: 0, diameterBottom: 6 + mRnd() * 3, height: h, tessellation: 5 }, scene);
        peak.position = new Vector3(Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist);
        peak.material = flatMat(scene, mountainTier >= 3 ? '#5c6672' : mountainTier === 2 ? '#4a5460' : '#3d4652');
        peak.parent = growthRoot;
        if (mountainTier >= 3) {
          const cap = MeshBuilder.CreateCylinder(`cap${i}`, { diameterTop: 0, diameterBottom: 2.2 + mRnd(), height: 1.6, tessellation: 5 }, scene);
          cap.position.y = h / 2 - 0.4;
          cap.material = flatMat(scene, '#eef4f8');
          cap.parent = peak;
        }
      }
    }

    // Weather: rain + rainbow at max sky level
    if (blue === 5) {
      const rainRnd = mulberry(701);
      const rainMat = flatMat(scene, '#cfe8f5', true);
      for (let i = 0; i < 30; i++) {
        const drop = MeshBuilder.CreateCylinder(`rain${i}`, { diameter: 0.05, height: 0.6 }, scene);
        drop.material = rainMat;
        drop.parent = growthRoot;
        const base = new Vector3((rainRnd() - 0.5) * GROUND_RADIUS * 1.6, 4 + rainRnd() * 6, (rainRnd() - 0.5) * GROUND_RADIUS * 1.6);
        drop.position = base.clone();
        animated.push({ mesh: drop, kind: 'fall', phase: 0, speed: 5 + rainRnd() * 3, base, radius: 0, resetY: 0.2 });
      }

      // A rainbow arc isn't a builder primitive in Babylon (CreateTorus has
      // no partial-arc option) — build one the same way as the river: a
      // tube following a hand-generated semicircle of points.
      RAINBOW.forEach((hex, i) => {
        const r = 16 - i * 0.5;
        const archPoints: Vector3[] = [];
        const segments = 32;
        for (let s = 0; s <= segments; s++) {
          const angle = Math.PI * (s / segments); // 0..PI: a dome, not a full ring
          archPoints.push(new Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 12));
        }
        const arc = MeshBuilder.CreateTube(`rainbow${i}`, { path: archPoints, radius: 0.18, tessellation: 8 }, scene);
        arc.material = flatMat(scene, hex, true);
        arc.parent = growthRoot;
      });
    }

    currentLevels = levels;
  }

  engine.runRenderLoop(() => scene.render());
  const handleResize = () => engine.resize();
  window.addEventListener('resize', handleResize);

  return {
    scene,
    camera,
    setLevels(levels: Levels) {
      const key = (l: Levels) => `${l.blue}${l.green}${l.brown}${l.grey}${l.pink}`;
      if (currentLevels && key(currentLevels) === key(levels)) return;
      buildGrowth(levels);
    },
    dispose() {
      window.removeEventListener('resize', handleResize);
      engine.dispose();
    },
  };
}
