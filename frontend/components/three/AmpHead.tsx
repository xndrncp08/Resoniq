"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { AmpSettings } from "@/types/tone";
import { AMP_KNOBS, clampKnob, type AmpKnob } from "@/lib/stores/rig-store";
import { controlPanel, grilleCloth, tolexBump, tubeGlowMask } from "@/components/three/textures";

const LABELS: Record<AmpKnob, string> = { gain: "GAIN", bass: "BASS", mids: "MIDDLE", treble: "TREBLE", presence: "PRESENCE" };

// Chassis and panel dimensions in scene units (roughly metres).
const W = 2;
const H = 0.78;
const D = 0.72;
const FRONT = D / 2;
const PANEL = { w: W - 0.14, h: 0.29, y: -0.225 };
const GRILLE = { w: W - 0.2, h: 0.32, y: 0.125 };
const KNOB_U = [0.3, 0.42, 0.54, 0.66, 0.78];
const KNOB_Y = PANEL.y + (0.5 - 0.46) * PANEL.h;
const SWEEP = Math.PI * 1.5;

const knobAngle = (v: number) => (0.5 - clampKnob(v) / 100) * SWEEP;

/** Exponential damping that converges regardless of frame rate. */
const damp = (from: number, to: number, lambda: number, dt: number) => THREE.MathUtils.lerp(from, to, 1 - Math.exp(-lambda * dt));

/** Frees a GPU resource when it's replaced or the scene unmounts. */
function useDisposal<T extends { dispose: () => void }>(value: T) {
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

// A machined knob: black anodized skirt and body, polished cap, copper pointer.
const KNOB_PROFILE = [
  [0, 0],
  [0.074, 0],
  [0.076, 0.006],
  [0.074, 0.018],
  [0.06, 0.022],
  [0.058, 0.07],
  [0.054, 0.078],
  [0.046, 0.082],
  [0, 0.082],
].map(([x, y]) => new THREE.Vector2(x, y));

function Knob({
  value,
  x,
  geometry,
  bodyMat,
  capMat,
  pointerMat,
  interactive,
  onChange,
}: {
  value: number;
  x: number;
  geometry: THREE.LatheGeometry;
  bodyMat: THREE.Material;
  capMat: THREE.Material;
  pointerMat: THREE.Material;
  interactive: boolean;
  onChange?: (v: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const reduced = useReducedMotion();
  const invalidate = useThree((s) => s.invalidate);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const target = knobAngle(value);
    g.rotation.z = reduced ? target : damp(g.rotation.z, target, 18, dt);
    if (Math.abs(g.rotation.z - target) > 0.0005) invalidate();
  });

  function grab(e: ThreeEvent<PointerEvent>) {
    if (!interactive || !onChange) return;
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, v: value };
    const el = e.nativeEvent.target as HTMLElement;
    el.style.cursor = "grabbing";
    // Up or right turns it up; 200 px of travel covers the whole sweep.
    const move = (ev: PointerEvent) => onChange(clampKnob(start.v + (ev.clientX - start.x - (ev.clientY - start.y)) / 2));
    const up = () => {
      el.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  return (
    <group position={[x, KNOB_Y, FRONT + 0.004]} scale={1.12}>
      <group
        ref={group}
        rotation={[0, 0, knobAngle(value)]}
        onPointerDown={grab}
        onPointerOver={(e) => interactive && ((e.nativeEvent.target as HTMLElement).style.cursor = "grab")}
        onPointerOut={(e) => interactive && ((e.nativeEvent.target as HTMLElement).style.cursor = "")}
      >
        <mesh geometry={geometry} material={bodyMat} rotation={[Math.PI / 2, 0, 0]} castShadow />
        <mesh position={[0, 0, 0.083]} material={capMat}>
          <circleGeometry args={[0.044, 48]} />
        </mesh>
        <mesh position={[0, 0.026, 0.0835]} material={pointerMat}>
          <planeGeometry args={[0.007, 0.034]} />
        </mesh>
        <mesh position={[0, 0.067, 0.02]} material={pointerMat}>
          <boxGeometry args={[0.008, 0.012, 0.004]} />
        </mesh>
      </group>
    </group>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/**
 * A guitar amp head modelled from primitives: pebbled tolex, cream piping,
 * woven cloth with the tubes glowing through it (brighter with more gain), a
 * brushed control panel and five knobs that turn with the tone's settings.
 */
export default function AmpHead({ amp, onKnob }: { amp: AmpSettings; onKnob?: (knob: AmpKnob, value: number) => void }) {
  const [font] = useState(() => getComputedStyle(document.documentElement).getPropertyValue("--font-plex-mono").trim() || "monospace");
  const bump = useDisposal(useMemo(() => tolexBump(), []));
  const cloth = useDisposal(useMemo(() => grilleCloth(), []));
  const glowMask = useDisposal(useMemo(() => tubeGlowMask(4), []));
  const panelTex = useDisposal(useMemo(() => controlPanel({ labels: AMP_KNOBS.map((k) => LABELS[k]), positions: KNOB_U, model: amp.model, font }), [amp.model, font]));
  const knobGeo = useDisposal(useMemo(() => new THREE.LatheGeometry(KNOB_PROFILE, 64), []));

  const mats = useDisposal(useMemo(() => {
    const tolex = new THREE.MeshStandardMaterial({ color: "#141518", roughness: 0.8, bumpMap: bump, bumpScale: 1.6 });
    const grille = new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.95, emissive: new THREE.Color("#ff9448"), emissiveMap: glowMask, emissiveIntensity: 0.4 });
    const panel = new THREE.MeshStandardMaterial({ map: panelTex, metalness: 0.75, roughness: 0.38 });
    const piping = new THREE.MeshStandardMaterial({ color: "#d8cbb0", roughness: 0.45 });
    const chrome = new THREE.MeshStandardMaterial({ color: "#d9dde3", metalness: 1, roughness: 0.16 });
    const knobBody = new THREE.MeshStandardMaterial({ color: "#16181c", metalness: 0.55, roughness: 0.32 });
    const knobCap = new THREE.MeshStandardMaterial({ color: "#e4e7ec", metalness: 0.9, roughness: 0.34 });
    const pointer = new THREE.MeshStandardMaterial({ color: "#ff8a3d", emissive: new THREE.Color("#ff8a3d"), emissiveIntensity: 1.4 });
    const jewel = new THREE.MeshStandardMaterial({ color: "#ff3b1f", emissive: new THREE.Color("#ff2a10"), emissiveIntensity: 2.4, roughness: 0.12 });
    const leather = new THREE.MeshStandardMaterial({ color: "#1b1512", roughness: 0.7 });
    const list = { tolex, grille, panel, piping, chrome, knobBody, knobCap, pointer, jewel, leather };
    return { ...list, dispose: () => Object.values(list).forEach((m) => m.dispose()) };
  }, [bump, cloth, glowMask, panelTex]));

  const handle = useDisposal(useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.32, 0, 0), new THREE.Vector3(-0.22, 0.09, 0), new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(0.22, 0.09, 0), new THREE.Vector3(0.32, 0, 0)]);
    return new THREE.TubeGeometry(curve, 48, 0.022, 12, false);
  }, []));

  // Tube glow follows gain: a cold amp idles dim, a cranked one burns.
  const glowLight = useRef<THREE.PointLight>(null);
  const grille = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>>(null);
  useFrame((state, dt) => {
    const material = grille.current?.material;
    if (!material) return;
    const target = 0.25 + (amp.gain / 100) * 1.5;
    const next = damp(material.emissiveIntensity, target, 6, dt);
    material.emissiveIntensity = next;
    if (glowLight.current) glowLight.current.intensity = next * 0.6;
    if (Math.abs(next - target) > 0.002) state.invalidate();
  });

  const pipe = 0.012;
  return (
    <group>
      <RoundedBox args={[W, H, D]} radius={0.045} smoothness={4} material={mats.tolex} castShadow receiveShadow />

      {/* Grille cloth framed by piping, glowing from the tubes behind. */}
      <mesh ref={grille} position={[0, GRILLE.y, FRONT + 0.002]} material={mats.grille}>
        <planeGeometry args={[GRILLE.w, GRILLE.h]} />
      </mesh>
      {[
        [0, GRILLE.y + GRILLE.h / 2, GRILLE.w + pipe, pipe],
        [0, GRILLE.y - GRILLE.h / 2, GRILLE.w + pipe, pipe],
        [-GRILLE.w / 2, GRILLE.y, pipe, GRILLE.h + pipe],
        [GRILLE.w / 2, GRILLE.y, pipe, GRILLE.h + pipe],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, FRONT + 0.006]} material={mats.piping}>
          <boxGeometry args={[w, h, pipe]} />
        </mesh>
      ))}
      <pointLight ref={glowLight} position={[0, GRILLE.y, FRONT + 0.25]} color="#ff7a2e" distance={1.6} decay={2} />

      {/* Control panel, recessed a hair behind its chrome trim. */}
      <mesh position={[0, PANEL.y, FRONT + 0.003]} material={mats.panel}>
        <planeGeometry args={[PANEL.w, PANEL.h]} />
      </mesh>
      <mesh position={[0, PANEL.y + PANEL.h / 2 + 0.004, FRONT + 0.004]} material={mats.chrome}>
        <boxGeometry args={[PANEL.w, 0.008, 0.008]} />
      </mesh>

      {AMP_KNOBS.map((k, i) => (
        <Knob
          key={k}
          value={amp[k]}
          x={(KNOB_U[i] - 0.5) * PANEL.w}
          geometry={knobGeo}
          bodyMat={mats.knobBody}
          capMat={mats.knobCap}
          pointerMat={mats.pointer}
          interactive={!!onKnob}
          onChange={onKnob && ((v) => onKnob(k, v))}
        />
      ))}

      {/* Power toggle and jewel lamp. */}
      <group position={[(0.875 - 0.5) * PANEL.w, KNOB_Y, FRONT + 0.004]}>
        <mesh material={mats.chrome} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.012, 24]} />
        </mesh>
        <mesh material={mats.chrome} position={[0, 0.02, 0.04]} rotation={[0.5, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.008, 0.08, 12]} />
        </mesh>
      </group>
      <group position={[(0.94 - 0.5) * PANEL.w, KNOB_Y, FRONT + 0.004]}>
        <mesh material={mats.chrome} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.03, 0.008, 12, 32]} />
        </mesh>
        <mesh material={mats.jewel}>
          <sphereGeometry args={[0.026, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>

      {/* Chrome corner protectors and a leather handle. */}
      {[-1, 1].flatMap((sx) => [-1, 1].flatMap((sy) => [-1, 1].map((sz) => (
        <mesh key={`${sx}${sy}${sz}`} position={[sx * (W / 2 - 0.03), sy * (H / 2 - 0.03), sz * (D / 2 - 0.03)]} material={mats.chrome} castShadow>
          <sphereGeometry args={[0.036, 20, 14]} />
        </mesh>
      ))))}
      <group position={[0, H / 2, 0]}>
        <mesh geometry={handle} material={mats.leather} castShadow />
        {[-0.32, 0.32].map((x) => (
          <mesh key={x} position={[x, 0.005, 0]} material={mats.chrome}>
            <boxGeometry args={[0.07, 0.02, 0.06]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
