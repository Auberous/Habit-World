// Thin React wrapper around the Babylon.js world (see buildWorld3d.ts) —
// owns the canvas and the World3D instance's lifecycle, and re-syncs
// growth whenever `levels` changes. This is the toggle target from
// App.tsx: "View in 3D (beta)" swaps the SVG stage for this component.
import { useEffect, useRef } from 'react';
import type { Levels } from '../habitData';
import { createWorld3D, type World3D } from './buildWorld3d';
import './Scene3D.css';

export default function Scene3D({ levels }: { levels: Levels }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const worldRef = useRef<World3D | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    const world = createWorld3D(canvasRef.current);
    worldRef.current = world;
    return () => {
      world.dispose();
      worldRef.current = null;
    };
    // Intentionally created once — canvas identity doesn't change across
    // re-renders, and levels are synced separately below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    worldRef.current?.setLevels(levels);
  }, [levels]);

  return <canvas ref={canvasRef} className="scene3d-canvas" />;
}
