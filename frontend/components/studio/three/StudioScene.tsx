"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import type { AmpKnob, AmpSwitch, StudioPatch } from "@/lib/studio/patch";
import type { StudioView } from "@/lib/stores/studio-store";
import Amp from "@/components/studio/three/Amp";
import Cab, { CAB_SIZE } from "@/components/studio/three/Cab";
import Pedalboard from "@/components/studio/three/Pedalboard";
import { LOOKS } from "@/components/studio/three/looks";

export type SceneProps = {
  patch: StudioPatch;
  view: StudioView;
  knobs: { key: AmpKnob; label: string }[];
  switches: { key: AmpSwitch; label: string }[];
  powered: boolean;
  onKnob: (key: AmpKnob, v: number) => void;
  onSwitch: (key: AmpSwitch) => void;
  onPower: () => void;
  onMic: (v: number) => void;
  onEffectParam: (id: string, key: string, v: number) => void;
  onEffectToggle: (id: string) => void;
  className?: string;
};

const FLOOR = -1.55;

function geometry(p: StudioPatch) {
  const [, ch] = CAB_SIZE[p.cab.model];
  const cabY = FLOOR + ch / 2;
  const [, ah] = LOOKS[p.amp.model].size;
  const ampY = FLOOR + ch + ah / 2 + 0.04;
  return { cabY, ampY, boardY: FLOOR + 0.09, boardZ: 1.25 };
}

/**
 * Glides between the three stations: the amp head, the cabinet (closer,
 * lower) and the pedalboard on the floor. Reduced motion cuts instead.
 * Narrow screens pull back so the rig always fits.
 */
function CameraRig({ patch, view }: { patch: StudioPatch; view: StudioView }) {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const reduced = useRef(false);
  const target = useRef(new THREE.Vector3());
  const first = useRef(true);
  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const g = geometry(patch);
  const fit = Math.max(1, 2.1 / aspect);
  const station =
    view === "cab" ? { pos: [0.3, g.cabY + 0.1, 3.7 * fit], look: [0, g.cabY, 0.2] }
    : view === "fx" ? { pos: [0, FLOOR + 0.85, g.boardZ + (0.75 + Math.max(2, patch.effects.length) * 0.2) * fit], look: [0, FLOOR + 0.05, g.boardZ] }
    : { pos: [0, g.ampY - 0.02, 3.25 * fit], look: [0, g.ampY - 0.1, 0] };
  useFrame((state, dt) => {
    const cam = state.camera;
    const px = reduced.current ? 0 : state.pointer.x * 0.12;
    const py = reduced.current ? 0 : state.pointer.y * 0.05;
    const goal = new THREE.Vector3(station.pos[0] + px, station.pos[1] + py, station.pos[2]);
    const look = new THREE.Vector3(...(station.look as [number, number, number]));
    const k = first.current || reduced.current ? 1 : 1 - Math.exp(-3.2 * dt);
    first.current = false;
    cam.position.lerp(goal, k);
    target.current.lerp(look, k);
    cam.lookAt(target.current);
    if (cam.position.distanceTo(goal) + target.current.distanceTo(look) > 0.0008) state.invalidate();
  });
  return null;
}

/**
 * The studio's 3D stage: one world holding the amp on its cabinet and a
 * pedalboard on the floor, rendered on demand. Reflections come from a
 * local light rig (no HDR download). The HTML controls beside it do
 * everything this does.
 */
export default function StudioScene(props: SceneProps) {
  const { patch, view } = props;
  const state = useRef<RootState | null>(null);
  const g = geometry(patch);
  const look = LOOKS[patch.amp.model];
  return (
    <Canvas
      className={props.className}
      frameloop="demand"
      dpr={[1, 1.75]}
      shadows={false}
      camera={{ position: [0, g.ampY, 3.3], fov: 30, near: 0.1, far: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={(s) => {
        state.current = s;
        s.gl.toneMapping = THREE.ACESFilmicToneMapping;
        s.gl.toneMappingExposure = 1.0;
      }}
      onPointerMove={() => state.current?.invalidate()}
      style={{ touchAction: "pan-y" }}
      aria-hidden
    >
      <CameraRig patch={patch} view={view} />
      <ambientLight intensity={0.12} />
      <spotLight position={[0.5, 3.5, 3.2]} angle={0.55} penumbra={0.9} intensity={38} color="#fff1e2" />
      <directionalLight position={[-3, 1.5, 2]} intensity={0.5} color="#bcd7ff" />
      {/* A work light over the pedalboard. */}
      <pointLight position={[0.4, FLOOR + 1.4, g.boardZ + 0.7]} intensity={5} distance={4} decay={2} color="#fff1e2" />
      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={2.6} position={[0, 2.5, 2.5]} scale={[5, 1.4, 1]} rotation-x={Math.PI / 3} color="#fff4e8" />
        <Lightformer form="rect" intensity={1.2} position={[-3.5, 0.6, 1]} scale={[1, 3, 1]} rotation-y={Math.PI / 2} color="#ffd6b0" />
        <Lightformer form="rect" intensity={0.9} position={[3.5, 0.6, -1]} scale={[1, 3, 1]} rotation-y={-Math.PI / 2} color="#b9e6ff" />
      </Environment>

      <group position={[0, g.ampY, 0.04]}>
        <Amp patch={patch} knobs={props.knobs} switches={props.switches} powered={props.powered} onKnob={props.onKnob} onSwitch={props.onSwitch} onPower={props.onPower} />
      </group>
      <group position={[0, g.cabY, 0]}>
        <Cab model={patch.cab.model} look={look} micPosition={patch.cab.micPosition} micDistance={patch.cab.micDistance} revealed={view === "cab"} onMic={props.onMic} />
      </group>
      <group position={[0, g.boardY, g.boardZ]}>
        <Pedalboard effects={patch.effects} onParam={props.onEffectParam} onToggle={props.onEffectToggle} />
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR, 0.6]} receiveShadow>
        <planeGeometry args={[12, 8]} />
        <meshStandardMaterial color="#0c0d10" roughness={0.95} />
      </mesh>
      <ContactShadows position={[0, FLOOR + 0.002, 0.5]} opacity={0.75} scale={8} blur={2.2} far={2.5} resolution={256} />
    </Canvas>
  );
}
