"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, PerspectiveCamera } from "@react-three/drei";
import type { AmpSettings } from "@/types/tone";
import type { AmpKnob } from "@/lib/stores/rig-store";
import AmpHead from "@/components/three/AmpHead";

const REST = { y: -0.32, x: 0.06 };

/** Turntable framing: settles in from the side once, then leans gently toward the pointer. */
function Stage({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current && group.current) group.current.rotation.set(REST.x, REST.y, 0);
  }, []);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g || reduced.current) return;
    const ty = REST.y + state.pointer.x * 0.22;
    const tx = REST.x - state.pointer.y * 0.06;
    const k = 1 - Math.exp(-4 * dt);
    g.rotation.y += (ty - g.rotation.y) * k;
    g.rotation.x += (tx - g.rotation.x) * k;
    if (Math.abs(ty - g.rotation.y) + Math.abs(tx - g.rotation.x) > 0.0005) state.invalidate();
  });
  return (
    <group ref={group} rotation={[REST.x, -1.1, 0]}>
      {children}
    </group>
  );
}

/** Pulls the camera back on narrow canvases so the whole head always fits. */
function Framing() {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const z = 2.85 * Math.max(1, 1.75 / aspect);
  return <PerspectiveCamera makeDefault position={[0, 0.12, z]} rotation={[-0.035, 0, 0]} fov={30} />;
}

/**
 * The amp in a small studio: softbox reflections from a local light rig (no
 * HDR download), a warm key, a cool rim and a contact shadow. Renders on
 * demand, so an idle amp costs no frames.
 */
export default function AmpScene({ amp, onKnob, className }: { amp: AmpSettings; onKnob?: (knob: AmpKnob, value: number) => void; className?: string }) {
  const state = useRef<RootState | null>(null);
  return (
    <Canvas
      className={className}
      frameloop="demand"
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      onCreated={(s) => {
        state.current = s;
        s.gl.toneMapping = THREE.ACESFilmicToneMapping;
        s.gl.toneMappingExposure = 1.05;
      }}
      onPointerMove={() => state.current?.invalidate()}
      style={{ touchAction: "pan-y" }}
      aria-hidden
    >
      <Framing />
      <ambientLight intensity={0.15} />
      <directionalLight position={[2.5, 3, 3]} intensity={1.6} color="#ffe1c4" />
      <directionalLight position={[-3, 1.5, -2]} intensity={1.2} color="#7fe9da" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 2.2, 2]} scale={[4, 1.2, 1]} rotation-x={Math.PI / 3} color="#fff4e8" />
        <Lightformer form="rect" intensity={2} position={[-3, 0.5, 1]} scale={[1, 3, 1]} rotation-y={Math.PI / 2} color="#ffb680" />
        <Lightformer form="rect" intensity={1.5} position={[3, 0.5, -1]} scale={[1, 3, 1]} rotation-y={-Math.PI / 2} color="#37e6c9" />
        <Lightformer form="circle" intensity={1} position={[0, -2, 0]} scale={2} rotation-x={-Math.PI / 2} color="#20242c" />
      </Environment>
      <Stage>
        <AmpHead amp={amp} onKnob={onKnob} />
      </Stage>
      <ContactShadows position={[0, -0.42, 0]} opacity={0.7} scale={4} blur={2.4} far={1} resolution={256} />
    </Canvas>
  );
}
