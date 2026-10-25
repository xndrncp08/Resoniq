"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { EFFECT_DESIGNS, type Effect } from "@/lib/studio/patch";
import { pedalFace } from "@/components/studio/three/paint";
import { fonts, knobAngle, useDisposal, useKnobDrag } from "@/components/studio/three/Amp";

export const PEDAL = { w: 0.3, d: 0.46, h: 0.11, gap: 0.08 };

function PedalKnob({ value, x, onChange, material }: { value: number; x: number; onChange: (v: number) => void; material: THREE.Material }) {
  const g = useRef<THREE.Group>(null);
  const grab = useKnobDrag(value, onChange);
  useFrame((state, dt) => {
    if (!g.current) return;
    const target = knobAngle(value);
    g.current.rotation.y = THREE.MathUtils.lerp(g.current.rotation.y, target, 1 - Math.exp(-20 * dt));
    if (Math.abs(g.current.rotation.y - target) > 0.0005) state.invalidate();
  });
  return (
    <group position={[x, PEDAL.h / 2, -0.1]}>
      <group ref={g} onPointerDown={grab} onPointerOver={(e) => ((e.nativeEvent.target as HTMLElement).style.cursor = "grab")} onPointerOut={(e) => ((e.nativeEvent.target as HTMLElement).style.cursor = "")}>
        <mesh material={material} position={[0, 0.02, 0]}><cylinderGeometry args={[0.03, 0.033, 0.04, 28]} /></mesh>
        <mesh position={[0, 0.041, -0.016]}><boxGeometry args={[0.005, 0.002, 0.022]} /><meshStandardMaterial color="#f3efe8" /></mesh>
      </group>
    </group>
  );
}

function Pedal({ effect, x, onParam, onToggle }: { effect: Effect; x: number; onParam: (key: string, v: number) => void; onToggle: () => void }) {
  const design = EFFECT_DESIGNS[effect.type];
  const [f] = useState(fonts);
  const face = useDisposal(useMemo(() => pedalFace(design.name, design.params.map((p) => p.label), design.color, f), [design, f]));
  const mats = useDisposal(useMemo(() => {
    const body = new THREE.MeshStandardMaterial({ color: design.color, metalness: 0.55, roughness: 0.35 });
    const top = new THREE.MeshStandardMaterial({ map: face, metalness: 0.4, roughness: 0.4 });
    const knob = new THREE.MeshStandardMaterial({ color: "#161618", metalness: 0.3, roughness: 0.4 });
    const chrome = new THREE.MeshStandardMaterial({ color: "#e4e8ee", metalness: 0.9, roughness: 0.3 });
    const list = { body, top, knob, chrome };
    return { ...list, dispose: () => Object.values(list).forEach((m) => m.dispose()) };
  }, [design, face]));
  const press = useRef<THREE.Mesh>(null);
  const [down, setDown] = useState(false);
  useEffect(() => {
    if (!down) return;
    const t = setTimeout(() => setDown(false), 120);
    return () => clearTimeout(t);
  }, [down]);
  const params = design.params.slice(0, 3);
  return (
    <group position={[x, 0, 0]}>
      <RoundedBox args={[PEDAL.w, PEDAL.h, PEDAL.d]} radius={0.018} smoothness={3} material={mats.body} castShadow />
      <mesh position={[0, PEDAL.h / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mats.top}><planeGeometry args={[PEDAL.w - 0.02, PEDAL.d - 0.02]} /></mesh>
      {params.map((p, i) => (
        <PedalKnob key={p.key} value={effect.params[p.key]} x={((i + 1) / (params.length + 1) - 0.5) * PEDAL.w} onChange={(v) => onParam(p.key, v)} material={mats.knob} />
      ))}
      <mesh position={[0, PEDAL.h / 2 + 0.012, -0.19]}>
        <sphereGeometry args={[0.01, 16, 12]} />
        <meshStandardMaterial color={effect.on ? "#ff3b2f" : "#2a0c0a"} emissive="#ff3b2f" emissiveIntensity={effect.on ? 2.5 : 0} />
      </mesh>
      <mesh
        ref={press}
        material={mats.chrome}
        position={[0, PEDAL.h / 2 + (down ? 0.008 : 0.016), 0.13]}
        onClick={(e) => { e.stopPropagation(); setDown(true); onToggle(); }}
        onPointerOver={(e) => ((e.nativeEvent.target as HTMLElement).style.cursor = "pointer")}
        onPointerOut={(e) => ((e.nativeEvent.target as HTMLElement).style.cursor = "")}
      >
        <cylinderGeometry args={[0.032, 0.034, 0.03, 28]} />
      </mesh>
    </group>
  );
}

/** The effects, left to right in signal order, on a board in front of the rig. */
export default function Pedalboard({ effects, onParam, onToggle }: { effects: Effect[]; onParam: (id: string, key: string, v: number) => void; onToggle: (id: string) => void }) {
  const width = Math.max(1.4, effects.length * (PEDAL.w + PEDAL.gap) + 0.3);
  const start = -((effects.length - 1) * (PEDAL.w + PEDAL.gap)) / 2;
  return (
    <group>
      <RoundedBox args={[width, 0.05, PEDAL.d + 0.22]} radius={0.02} smoothness={3} position={[0, -PEDAL.h / 2 - 0.03, 0]} receiveShadow>
        <meshStandardMaterial color="#141416" roughness={0.9} />
      </RoundedBox>
      {effects.map((e, i) => (
        <Pedal key={e.id} effect={e} x={start + i * (PEDAL.w + PEDAL.gap)} onParam={(k, v) => onParam(e.id, k, v)} onToggle={() => onToggle(e.id)} />
      ))}
    </group>
  );
}
