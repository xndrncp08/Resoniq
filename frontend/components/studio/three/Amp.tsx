"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { AmpKnob, AmpSwitch, StudioPatch } from "@/lib/studio/patch";
import { LOOKS, panelLayout, type Look } from "@/components/studio/three/looks";
import { faceplate, front, tolexBump } from "@/components/studio/three/paint";

export const SWEEP = Math.PI * 1.5;
export const knobAngle = (v: number) => (0.5 - Math.max(0, Math.min(10, v)) / 10) * SWEEP;
const damp = (a: number, b: number, l: number, dt: number) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-l * dt));

/** Frees GPU resources when they're replaced or the scene unmounts. */
export function useDisposal<T extends { dispose: () => void }>(value: T) {
  useEffect(() => () => value.dispose(), [value]);
  return value;
}

export function fonts() {
  const css = getComputedStyle(document.documentElement);
  return { display: css.getPropertyValue("--font-space-grotesk").trim() || "sans-serif", mono: css.getPropertyValue("--font-plex-mono").trim() || "monospace" };
}

/** Vertical drag turns a knob: 220 px covers the sweep, Shift for fine moves. Writes go to the store. */
export function useKnobDrag(value: number, onChange?: (v: number) => void) {
  return (e: ThreeEvent<PointerEvent>) => {
    if (!onChange) return;
    e.stopPropagation();
    const el = e.nativeEvent.target as HTMLElement;
    let last = e.clientY;
    let v = value;
    el.style.cursor = "grabbing";
    const move = (ev: PointerEvent) => {
      const step = ((last - ev.clientY) / 220) * 10 * (ev.shiftKey ? 0.2 : 1);
      last = ev.clientY;
      v = Math.max(0, Math.min(10, v + step));
      onChange(Math.round(v * 10) / 10);
    };
    const up = () => {
      el.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
}

const hover = (cursor: string) => ({
  onPointerOver: (e: ThreeEvent<PointerEvent>) => ((e.nativeEvent.target as HTMLElement).style.cursor = cursor),
  onPointerOut: (e: ThreeEvent<PointerEvent>) => ((e.nativeEvent.target as HTMLElement).style.cursor = ""),
});

// ── Knobs ──────────────────────────────────────────────────────────────

/** Two geometries as one, so a knob body draws in a single call. */
function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry) {
  const parts = [a.index ? a.toNonIndexed() : a, b.index ? b.toNonIndexed() : b];
  const merged = new THREE.BufferGeometry();
  for (const name of ["position", "normal"]) {
    const arrays = parts.map((g) => g.getAttribute(name).array as Float32Array);
    const out = new Float32Array(arrays.reduce((n, x) => n + x.length, 0));
    let o = 0;
    for (const arr of arrays) { out.set(arr, o); o += arr.length; }
    merged.setAttribute(name, new THREE.BufferAttribute(out, 3));
  }
  for (const g of [a, b, ...parts]) if (g !== merged) g.dispose();
  return merged;
}

const CHICKEN = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.068);
  s.bezierCurveTo(0.018, 0.06, 0.03, 0.02, 0.03, -0.01);
  s.bezierCurveTo(0.03, -0.035, 0.016, -0.05, 0, -0.05);
  s.bezierCurveTo(-0.016, -0.05, -0.03, -0.035, -0.03, -0.01);
  s.bezierCurveTo(-0.03, 0.02, -0.018, 0.06, 0, 0.068);
  return s;
})();

function knobGeometries(style: Look["knob"]["style"]) {
  if (style === "chicken") {
    const skirt = new THREE.CylinderGeometry(0.036, 0.042, 0.026, 48);
    skirt.rotateX(Math.PI / 2);
    skirt.translate(0, 0, 0.013);
    const head = new THREE.ExtrudeGeometry(CHICKEN, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 24 });
    head.scale(1.3, 1.3, 1);
    head.translate(0, 0, 0.026);
    skirt.computeVertexNormals();
    // The cream line inlaid along the pointer.
    const line = new THREE.BoxGeometry(0.006, 0.07, 0.002);
    line.translate(0, 0.04, 0.0735);
    return { skirt: mergeTwo(skirt, head), head: line };
  }
  // Knurled: a ribbed cylinder; dome: a smooth rounded cap. Both turned on a lathe.
  const pts: THREE.Vector2[] = [];
  const r = style === "dome" ? 0.05 : 0.046;
  pts.push(new THREE.Vector2(0, 0), new THREE.Vector2(r + 0.008, 0), new THREE.Vector2(r + 0.008, 0.008));
  if (style === "dome") {
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * (Math.PI / 2);
      pts.push(new THREE.Vector2(r * Math.cos(a), 0.012 + 0.045 * Math.sin(a)));
    }
  } else {
    pts.push(new THREE.Vector2(r, 0.012), new THREE.Vector2(r, 0.056), new THREE.Vector2(r - 0.006, 0.062), new THREE.Vector2(0, 0.062));
  }
  const skirt = new THREE.LatheGeometry(pts, style === "knurled" ? 36 : 56);
  if (style === "knurled") {
    // Ribs: push every other lathe column outward.
    const pos = skirt.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = pos.getY(i);
      if (y > 0.013 && y < 0.055) {
        const a = Math.atan2(z, x);
        const k = 1 + 0.06 * Math.max(0, Math.cos(a * 18));
        pos.setX(i, x * k);
        pos.setZ(i, z * k);
      }
    }
    skirt.computeVertexNormals();
  }
  skirt.rotateX(Math.PI / 2);
  const head = new THREE.BoxGeometry(0.006, 0.03, 0.004);
  head.translate(0, 0.024, style === "dome" ? 0.058 : 0.063);
  return { skirt, head };
}

function Knob({ value, x, y, geo, mats, onChange }: { value: number; x: number; y: number; geo: ReturnType<typeof knobGeometries>; mats: { body: THREE.Material; pointer: THREE.Material }; onChange?: (v: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const grab = useKnobDrag(value, onChange);
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const target = knobAngle(value);
    g.rotation.z = damp(g.rotation.z, target, 20, dt);
    if (Math.abs(g.rotation.z - target) > 0.0005) state.invalidate();
  });
  return (
    <group position={[x, y, 0]}>
      <group ref={group} rotation={[0, 0, knobAngle(value)]} onPointerDown={grab} {...(onChange ? hover("grab") : {})}>
        <mesh geometry={geo.skirt} material={mats.body} castShadow />
        <mesh geometry={geo.head} material={mats.pointer} />
      </group>
    </group>
  );
}

// ── Switches, power, jack ──────────────────────────────────────────────

function Toggle({ on, x, y, chrome, onToggle }: { on: boolean; x: number; y: number; chrome: THREE.Material; onToggle: () => void }) {
  const lever = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (!lever.current) return;
    const target = on ? -0.55 : 0.55;
    lever.current.rotation.x = damp(lever.current.rotation.x, target, 30, dt);
    if (Math.abs(lever.current.rotation.x - target) > 0.001) state.invalidate();
  });
  return (
    <group position={[x, y, 0]} onClick={(e) => { e.stopPropagation(); onToggle(); }} {...hover("pointer")}>
      <mesh material={chrome} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.022, 0.024, 0.012, 24]} /></mesh>
      <mesh ref={lever} material={chrome} position={[0, 0, 0.008]} rotation={[on ? -0.55 : 0.55, 0, 0]}>
        <cylinderGeometry args={[0.005, 0.008, 0.07, 12]} />
      </mesh>
      <mesh position={[0, 0, 0.03]} visible={false}><boxGeometry args={[0.07, 0.09, 0.06]} /></mesh>
    </group>
  );
}

function Button({ on, x, y, ring, ledColor, onToggle }: { on: boolean; x: number; y: number; ring: THREE.Material; ledColor: string; onToggle: () => void }) {
  return (
    <group position={[x, y, 0]} onClick={(e) => { e.stopPropagation(); onToggle(); }} {...hover("pointer")}>
      <mesh material={ring} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.024, 0.006, 12, 32]} /></mesh>
      <mesh material={ring} position={[0, 0, on ? 0.004 : 0.01]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.018, 0.018, 0.012, 24]} /></mesh>
      <mesh position={[0, 0.06, 0.004]}>
        <sphereGeometry args={[0.008, 16, 12]} />
        <meshStandardMaterial color={on ? ledColor : "#1a1a1a"} emissive={ledColor} emissiveIntensity={on ? 2.6 : 0} />
      </mesh>
    </group>
  );
}

function Power({ kind, on, x, y, chrome, onToggle }: { kind: Look["power"]; on: boolean; x: number; y: number; chrome: THREE.Material; onToggle: () => void }) {
  const lamp = <meshStandardMaterial color="#3a0905" emissive={kind === "rocker" ? "#ff2a12" : "#7cf3d6"} emissiveIntensity={on ? (kind === "rocker" ? 1.5 : 2.4) : 0.15} roughness={0.25} />;
  return (
    <group position={[x, y, 0]} onClick={(e) => { e.stopPropagation(); onToggle(); }} {...hover("pointer")}>
      {kind === "rocker" ? (
        <>
          <mesh material={chrome} position={[0, 0, 0.004]}><boxGeometry args={[0.07, 0.1, 0.008]} /></mesh>
          <mesh position={[0, 0, 0.014]} rotation={[on ? -0.18 : 0.18, 0, 0]}><boxGeometry args={[0.052, 0.08, 0.018]} />{lamp}</mesh>
        </>
      ) : (
        <>
          <mesh material={chrome} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.022, 0.006, 12, 32]} /></mesh>
          <mesh position={[0, 0, 0.006]}><sphereGeometry args={[0.016, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />{lamp}</mesh>
        </>
      )}
    </group>
  );
}

function Jack({ x, y, chrome }: { x: number; y: number; chrome: THREE.Material }) {
  const cable = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0.06), new THREE.Vector3(-0.02, -0.04, 0.12), new THREE.Vector3(-0.12, -0.2, 0.2), new THREE.Vector3(-0.32, -0.42, 0.22), new THREE.Vector3(-0.6, -0.6, 0.18)]);
    return new THREE.TubeGeometry(curve, 48, 0.012, 10, false);
  }, []);
  useDisposal(cable);
  const rubber = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 0.55 }), []);
  useDisposal(rubber);
  return (
    <group position={[x, y, 0]}>
      <mesh material={chrome} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.024, 0.016, 24]} /></mesh>
      <mesh material={chrome} position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.011, 0.011, 0.05, 16]} /></mesh>
      <mesh material={rubber} position={[0, 0, 0.068]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.016, 0.014, 0.03, 16]} /></mesh>
      <mesh geometry={cable} material={rubber} castShadow />
    </group>
  );
}

// ── Tubes ──────────────────────────────────────────────────────────────

function Tubes({ width, glowRef, color }: { width: number; glowRef: React.RefObject<THREE.MeshStandardMaterial | null>; color: string }) {
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d8e2ea", transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false }), []);
  const plate = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a2b2e", metalness: 0.7, roughness: 0.5 }), []);
  const heater = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2b1306", emissive: new THREE.Color(color), emissiveIntensity: 1 }), [color]);
  useDisposal(glass);
  useDisposal(plate);
  useDisposal(heater);
  useEffect(() => {
    glowRef.current = heater;
  }, [heater, glowRef]);
  const power = [-0.42, -0.14, 0.14, 0.42].map((x) => x * (width / 2));
  const pre = [-0.78, -0.62, 0.62].map((x) => x * (width / 2));
  return (
    <group>
      {[...power.map((x) => ({ x, s: 1 })), ...pre.map((x) => ({ x, s: 0.62 }))].map(({ x, s }, i) => (
        <group key={i} position={[x, -0.02 * s, -0.12]} scale={s}>
          <mesh material={glass}><cylinderGeometry args={[0.055, 0.055, 0.24, 24, 1, true]} /></mesh>
          <mesh material={glass} position={[0, 0.12, 0]}><sphereGeometry args={[0.055, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
          <mesh material={plate} position={[0, 0.01, 0]}><boxGeometry args={[0.06, 0.12, 0.025]} /></mesh>
          <mesh material={heater} position={[0, -0.04, 0.016]}><boxGeometry args={[0.03, 0.03, 0.004]} /></mesh>
          <mesh material={plate} position={[0, -0.135, 0]}><cylinderGeometry args={[0.06, 0.062, 0.03, 24]} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ── The amp ────────────────────────────────────────────────────────────

/** Where the parts of a head sit, in its own coordinates (also used to frame close-up renders). */
export function ampFrame(look: Look) {
  const [W, H, D] = look.size;
  const GH = H - 0.1 - 0.25 - 0.04;
  const PANEL = { h: 0.25, y: -H / 2 + 0.05 + 0.125 };
  return { W, H, D, FRONT: D / 2, PANEL, GRILLE: { h: GH, y: H / 2 - 0.05 - GH / 2 }, PW: W - 0.12, RECESS: 0.22, controlsY: PANEL.y + (0.5 - 0.56) * PANEL.h };
}

export type AmpProps = {
  patch: StudioPatch;
  knobs: { key: AmpKnob; label: string }[];
  switches: { key: AmpSwitch; label: string }[];
  powered: boolean;
  onKnob?: (key: AmpKnob, v: number) => void;
  onSwitch?: (key: AmpSwitch) => void;
  onPower?: () => void;
};

/**
 * One of five original amp designs, built from primitives and painted
 * surfaces. Every control on it is live: knobs and switches write the
 * studio's patch, the power switch starts and stops the audio preview, and
 * the tubes (or the gold veins) burn brighter with gain and master.
 */
export default function Amp({ patch, knobs, switches, powered, onKnob, onSwitch, onPower }: AmpProps) {
  const look = LOOKS[patch.amp.model];
  const { W, H, D, FRONT, PANEL, GRILLE, PW, RECESS } = ampFrame(look);
  const layout = useMemo(() => panelLayout(knobs, switches), [knobs, switches]);
  const [f] = useState(fonts);

  const bump = useDisposal(useMemo(() => tolexBump(look.tolex.grain), [look.tolex.grain]));
  const panelTex = useDisposal(useMemo(() => faceplate(layout, look.panel, look.logo, f), [layout, look, f]));
  const frontTex = useMemo(() => front(look.front.kind), [look.front.kind]);
  useEffect(() => () => Object.values(frontTex).forEach((t) => t?.dispose()), [frontTex]);

  const mats = useDisposal(useMemo(() => {
    const tolex = new THREE.MeshPhysicalMaterial({ color: look.tolex.color, roughness: look.tolex.roughness, bumpMap: bump, bumpScale: 1.8, sheen: look.tolex.sheen ?? 0, sheenColor: new THREE.Color("#ffffff") });
    const panel = new THREE.MeshStandardMaterial({ map: panelTex, metalness: look.panel.metalness, roughness: look.panel.roughness });
    const fk = look.front.kind;
    const frontMat =
      fk === "kintsugi"
        ? new THREE.MeshStandardMaterial({ map: frontTex.map, emissiveMap: frontTex.emissive, emissive: new THREE.Color(look.front.glow), emissiveIntensity: 0.4, metalness: 0.4, roughness: 0.2 })
        : fk === "glass"
          ? new THREE.MeshStandardMaterial({ color: look.front.color, bumpMap: frontTex.bump, bumpScale: 5, transparent: true, opacity: 0.62, roughness: 0.14, metalness: 0.05, emissive: new THREE.Color(look.front.glow), emissiveIntensity: 0.2 })
          : new THREE.MeshStandardMaterial({ color: look.front.color, alphaMap: frontTex.alpha, transparent: true, alphaTest: 0.5, metalness: look.front.metalness, roughness: look.front.roughness, side: THREE.DoubleSide });
    const interior = new THREE.MeshStandardMaterial({ color: "#060607", roughness: 0.9 });
    const chrome = new THREE.MeshStandardMaterial({ color: "#dfe3e8", metalness: 1, roughness: 0.18 });
    const corner = new THREE.MeshStandardMaterial({ color: look.corners ?? "#000", metalness: look.corners === "#1a1a1a" ? 0.3 : 1, roughness: 0.3 });
    const knobBody = new THREE.MeshPhysicalMaterial({ color: look.knob.body, metalness: look.knob.metalness, roughness: look.knob.roughness, clearcoat: look.knob.glassy ? 1 : 0.4, ...(look.knob.glassy && { transmission: 0, transparent: true, opacity: 0.92 }) });
    const pointer = new THREE.MeshStandardMaterial({ color: look.knob.pointer, emissive: new THREE.Color(look.knob.pointer), emissiveIntensity: 0.25, metalness: 0.3 });
    const strap = new THREE.MeshStandardMaterial({ color: look.handle.strap, roughness: look.handle.strap === "#c9ced6" || look.handle.strap === "#d9dde2" ? 0.2 : 0.7, metalness: look.handle.strap.startsWith("#c9") || look.handle.strap.startsWith("#d9") ? 1 : 0 });
    const ends = new THREE.MeshStandardMaterial({ color: look.handle.ends, metalness: 1, roughness: 0.22 });
    const piping = new THREE.MeshStandardMaterial({ color: look.piping ?? "#000", metalness: 0.6, roughness: 0.3 });
    const backlight = new THREE.MeshBasicMaterial({ color: look.front.backlight?.[0] ?? "#000" });
    const list = { tolex, panel, frontMat, interior, chrome, corner, knobBody, pointer, strap, ends, piping, backlight };
    return { ...list, dispose: () => Object.values(list).forEach((m) => m.dispose()) };
  }, [look, bump, panelTex, frontTex]));

  const geo = useMemo(() => knobGeometries(look.knob.style), [look.knob.style]);
  useEffect(() => () => { geo.skirt.dispose(); geo.head.dispose(); }, [geo]);
  const handle = useDisposal(useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(-0.2, 0.07, 0), new THREE.Vector3(0, 0.09, 0), new THREE.Vector3(0.2, 0.07, 0), new THREE.Vector3(0.3, 0, 0)]);
    return new THREE.TubeGeometry(curve, 40, 0.02, 10, false);
  }, []));

  // Gain and master set how hard the tubes glow; Prism's glass backlight and Kintsugi's veins follow too.
  const heater = useRef<THREE.MeshStandardMaterial | null>(null);
  const frontMesh = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>>(null);
  const light = useRef<THREE.PointLight>(null);
  const heat = (powered ? 0.35 : 0.08) + (powered ? (patch.amp.gain / 10) * 1.6 + (patch.amp.master / 10) * 0.6 : 0);
  useFrame((state, dt) => {
    let moving = false;
    const step = (cur: number, target: number) => {
      const next = damp(cur, target, 5, dt);
      if (Math.abs(next - target) > 0.002) moving = true;
      return next;
    };
    if (heater.current) heater.current.emissiveIntensity = step(heater.current.emissiveIntensity, heat * 2.2);
    if (light.current) light.current.intensity = step(light.current.intensity, heat * 1.6);
    const fm = frontMesh.current?.material;
    if (fm && look.front.kind === "kintsugi") fm.emissiveIntensity = step(fm.emissiveIntensity, 0.15 + heat * 0.9);
    if (fm && look.front.kind === "glass") fm.emissiveIntensity = step(fm.emissiveIntensity, 0.12 + heat * 0.45);
    if (moving) state.invalidate();
  });

  const knobByKey = new Map(knobs.map((k) => [k.key, k]));
  const panelY = ampFrame(look).controlsY;
  return (
    <group>
      {/* A shallower core box plus a front frame, which leaves a real recess behind the grille for the tubes. */}
      <RoundedBox args={[W, H, D - RECESS]} position={[0, 0, -RECESS / 2]} radius={0.04} smoothness={4} material={mats.tolex} castShadow receiveShadow />
      <RoundedBox args={[W, H / 2 - (GRILLE.y + GRILLE.h / 2), RECESS]} position={[0, (H / 2 + GRILLE.y + GRILLE.h / 2) / 2, FRONT - RECESS / 2]} radius={0.02} smoothness={3} material={mats.tolex} />
      <RoundedBox args={[W, GRILLE.y - GRILLE.h / 2 + H / 2, RECESS]} position={[0, (GRILLE.y - GRILLE.h / 2 - H / 2) / 2, FRONT - RECESS / 2]} radius={0.02} smoothness={3} material={mats.tolex} />
      {[-1, 1].map((sx) => (
        <RoundedBox key={sx} args={[0.07, GRILLE.h + 0.02, RECESS]} position={[sx * (W / 2 - 0.035), GRILLE.y, FRONT - RECESS / 2]} radius={0.015} smoothness={3} material={mats.tolex} />
      ))}

      {/* Front recess: interior, tubes, the design's grille or art panel. */}
      <mesh position={[0, GRILLE.y, FRONT - RECESS + 0.003]} material={mats.interior}>
        <planeGeometry args={[W - 0.14, GRILLE.h]} />
      </mesh>
      {look.tubes && (
        <group position={[0, GRILLE.y, FRONT]}>
          <Tubes width={W - 0.3} glowRef={heater} color={look.front.glow} />
        </group>
      )}
      {look.front.backlight && (
        <mesh position={[0, GRILLE.y, FRONT - 0.05]}>
          <planeGeometry args={[W - 0.16, GRILLE.h]} />
          <meshBasicMaterial color={look.front.backlight[1]} transparent opacity={0.35 + (powered ? heat * 0.2 : 0)} />
        </mesh>
      )}
      <pointLight ref={light} position={[0, GRILLE.y, FRONT - 0.05]} color={look.front.glow} distance={1.4} decay={2} intensity={0} />
      <mesh ref={frontMesh} position={[0, GRILLE.y, FRONT + 0.003]} material={mats.frontMat}>
        <planeGeometry args={[W - 0.14, GRILLE.h]} />
      </mesh>
      {look.piping &&
        [
          [0, GRILLE.y + GRILLE.h / 2, W - 0.13, 0.012],
          [0, GRILLE.y - GRILLE.h / 2, W - 0.13, 0.012],
          [-(W - 0.14) / 2, GRILLE.y, 0.012, GRILLE.h + 0.012],
          [(W - 0.14) / 2, GRILLE.y, 0.012, GRILLE.h + 0.012],
        ].map(([x, y, w, h], i) => (
          <mesh key={i} position={[x, y, FRONT + 0.006]} material={mats.piping}><boxGeometry args={[w, h, 0.01]} /></mesh>
        ))}

      {/* Faceplate and everything mounted on it. */}
      <mesh position={[0, PANEL.y, FRONT + 0.004]} material={mats.panel}>
        <planeGeometry args={[PW, PANEL.h]} />
      </mesh>
      <group position={[0, 0, FRONT + 0.006]}>
        {layout.map((it, i) => {
          const x = (it.u - 0.5) * PW;
          if (it.kind === "jack") return <Jack key={i} x={x} y={panelY} chrome={mats.chrome} />;
          if (it.kind === "power") return <Power key={i} kind={look.power} on={powered} x={x} y={panelY} chrome={mats.chrome} onToggle={() => onPower?.()} />;
          if (it.kind === "switch" && it.key) {
            const k = it.key as AmpSwitch;
            return look.switches === "toggle"
              ? <Toggle key={i} on={patch.amp[k]} x={x} y={panelY} chrome={mats.chrome} onToggle={() => onSwitch?.(k)} />
              : <Button key={i} on={patch.amp[k]} x={x} y={panelY - 0.01} ring={mats.ends} ledColor="#6dff9c" onToggle={() => onSwitch?.(k)} />;
          }
          const k = it.key as AmpKnob;
          return knobByKey.has(k) ? <Knob key={i} value={patch.amp[k]} x={x} y={panelY} geo={geo} mats={{ body: mats.knobBody, pointer: mats.pointer }} onChange={onKnob && ((v) => onKnob(k, v))} /> : null;
        })}
      </group>

      {/* Hardware: corner caps, handle, feet. */}
      {look.corners &&
        [-1, 1].flatMap((sx) => [-1, 1].map((sy) => (
          <RoundedBox key={`${sx}${sy}`} args={[0.06, 0.06, 0.05]} radius={0.014} smoothness={3} position={[sx * (W / 2 - 0.022), sy * (H / 2 - 0.022), FRONT - 0.018]} material={mats.corner} castShadow />
        )))}
      <group position={[0, H / 2, 0]}>
        <mesh geometry={handle} material={mats.strap} castShadow />
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 0.008, 0]} material={mats.ends}><boxGeometry args={[0.07, 0.022, 0.06]} /></mesh>
        ))}
      </group>
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * (W / 2 - 0.22), -H / 2 - 0.02, FRONT - 0.15]} material={mats.interior}>
          <cylinderGeometry args={[0.05, 0.06, 0.04, 20]} />
        </mesh>
      ))}
    </group>
  );
}
