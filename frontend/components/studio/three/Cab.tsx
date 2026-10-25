"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import type { CabModelId } from "@/lib/studio/patch";
import { cloth, tolexBump } from "@/components/studio/three/paint";
import { useDisposal } from "@/components/studio/three/Amp";
import type { Look } from "@/components/studio/three/looks";

export const CAB_SIZE: Record<CabModelId, [number, number, number]> = {
  "4x12-closed": [2.12, 1.42, 0.8],
  "2x12-open": [2.0, 0.96, 0.7],
  "1x12-open": [1.18, 0.96, 0.62],
};

const R = 0.27;

export function speakerSpots(model: CabModelId): [number, number][] {
  const [w, h] = CAB_SIZE[model];
  if (model === "4x12-closed") return [[-w / 4.4, h / 5.2], [w / 4.4, h / 5.2], [-w / 4.4, -h / 5.2], [w / 4.4, -h / 5.2]];
  if (model === "2x12-open") return [[-w / 4.2, 0], [w / 4.2, 0]];
  return [[0, 0]];
}

const CONE = (() => {
  const pts = [new THREE.Vector2(0.06, -0.09), new THREE.Vector2(0.12, -0.06), new THREE.Vector2(0.2, -0.025), new THREE.Vector2(0.245, -0.005), new THREE.Vector2(0.26, 0)];
  const g = new THREE.LatheGeometry(pts, 64);
  g.rotateX(Math.PI / 2);
  return g;
})();

/**
 * The cabinet under the amp. In the cabinet view its cloth turns sheer to
 * show the speakers and the mic in front of one of them; dragging the mic
 * sideways changes the same mic-position control as the slider.
 */
export default function Cab({ model, look, micPosition, micDistance, revealed, onMic }: { model: CabModelId; look: Look; micPosition: number; micDistance: number; revealed: boolean; onMic?: (v: number) => void }) {
  const [W, H, D] = CAB_SIZE[model];
  const FRONT = D / 2;
  const RECESS = 0.12;
  const bump = useDisposal(useMemo(() => tolexBump(look.tolex.grain, 21), [look.tolex.grain]));
  const clothTex = useDisposal(useMemo(() => cloth([42, 40, 38]), []));
  const mats = useDisposal(useMemo(() => {
    const tolex = new THREE.MeshPhysicalMaterial({ color: look.tolex.color, roughness: look.tolex.roughness, bumpMap: bump, bumpScale: 1.8, sheen: look.tolex.sheen ?? 0 });
    const baffle = new THREE.MeshStandardMaterial({ color: "#0b0b0c", roughness: 0.95 });
    const cone = new THREE.MeshStandardMaterial({ color: "#1c1a18", roughness: 0.85, side: THREE.DoubleSide });
    const cap = new THREE.MeshStandardMaterial({ color: "#2a2724", roughness: 0.5 });
    const ring = new THREE.MeshStandardMaterial({ color: "#3b3d42", metalness: 0.8, roughness: 0.4 });
    const micBody = new THREE.MeshStandardMaterial({ color: "#121316", metalness: 0.6, roughness: 0.35 });
    const micHead = new THREE.MeshStandardMaterial({ color: "#8d939b", metalness: 0.9, roughness: 0.45 });
    const list = { tolex, baffle, cone, cap, ring, micBody, micHead };
    return { ...list, dispose: () => Object.values(list).forEach((m) => m.dispose()) };
  }, [look, bump]));

  const clothMesh = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>>(null);
  const mic = useRef<THREE.Group>(null);
  const spots = speakerSpots(model);
  const [sx, sy] = spots.length === 4 ? spots[1] : spots[spots.length - 1];
  const micX = sx - (micPosition / 10) * R * 0.85;
  const micZ = FRONT + 0.07 + (micDistance / 10) * 0.32;

  useFrame((state, dt) => {
    let moving = false;
    const m = clothMesh.current?.material;
    if (m) {
      const target = revealed ? 0.12 : 1;
      m.opacity = THREE.MathUtils.lerp(m.opacity, target, 1 - Math.exp(-6 * dt));
      if (Math.abs(m.opacity - target) > 0.003) moving = true;
    }
    const g = mic.current;
    if (g) {
      g.position.x = THREE.MathUtils.lerp(g.position.x, micX, 1 - Math.exp(-14 * dt));
      g.position.z = THREE.MathUtils.lerp(g.position.z, micZ, 1 - Math.exp(-14 * dt));
      if (Math.abs(g.position.x - micX) + Math.abs(g.position.z - micZ) > 0.0005) moving = true;
    }
    if (moving) state.invalidate();
  });

  function dragMic(e: ThreeEvent<PointerEvent>) {
    if (!onMic || !revealed) return;
    e.stopPropagation();
    const el = e.nativeEvent.target as HTMLElement;
    let last = e.clientX;
    let v = micPosition;
    const move = (ev: PointerEvent) => {
      v = Math.max(0, Math.min(10, v - ((ev.clientX - last) / 160) * 10));
      last = ev.clientX;
      onMic(Math.round(v * 10) / 10);
    };
    const up = () => {
      el.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    el.style.cursor = "grabbing";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <group>
      {/* Core box set back, with a tolex frame in front: the baffle, speakers and cloth sit in the recess. */}
      <RoundedBox args={[W, H, D - RECESS]} position={[0, 0, -RECESS / 2]} radius={0.045} smoothness={4} material={mats.tolex} castShadow receiveShadow />
      {[
        [0, H / 2 - 0.03, W, 0.06],
        [0, -H / 2 + 0.03, W, 0.06],
        [-W / 2 + 0.03, 0, 0.06, H],
        [W / 2 - 0.03, 0, 0.06, H],
      ].map(([x, y, w, h], i) => (
        <RoundedBox key={i} args={[w, h, RECESS]} position={[x, y, FRONT - RECESS / 2]} radius={0.02} smoothness={3} material={mats.tolex} />
      ))}
      <mesh position={[0, 0, FRONT - RECESS + 0.004]} material={mats.baffle}><planeGeometry args={[W - 0.12, H - 0.12]} /></mesh>
      {spots.map(([x, y], i) => (
        <group key={i} position={[x, y, FRONT - RECESS + 0.1]}>
          <mesh geometry={CONE} material={mats.cone} />
          <mesh material={mats.cap} position={[0, 0, -0.07]}><sphereGeometry args={[0.065, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
          <mesh material={mats.ring} rotation={[0, 0, 0]}><torusGeometry args={[R, 0.012, 10, 64]} /></mesh>
        </group>
      ))}
      <mesh ref={clothMesh} position={[0, 0, FRONT - 0.005]}>
        <planeGeometry args={[W - 0.12, H - 0.12]} />
        <meshStandardMaterial map={clothTex} transparent opacity={1} roughness={0.95} depthWrite={false} />
      </mesh>
      {/* A dynamic mic on a boom, aimed at one speaker. */}
      <group ref={mic} position={[micX, sy, micZ]} visible={revealed} onPointerDown={dragMic} onPointerOver={(e) => revealed && ((e.nativeEvent.target as HTMLElement).style.cursor = "grab")} onPointerOut={(e) => ((e.nativeEvent.target as HTMLElement).style.cursor = "")}>
        <mesh material={mats.micHead} position={[0, 0, -0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.03, 0.026, 0.06, 24]} /></mesh>
        <mesh material={mats.micBody} position={[0, 0, 0.07]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.02, 0.024, 0.15, 24]} /></mesh>
        <mesh material={mats.micBody} position={[0, -(H / 2 + sy) / 2 - 0.05, 0.16]}><cylinderGeometry args={[0.008, 0.008, H / 2 + sy + 0.1, 8]} /></mesh>
      </group>
    </group>
  );
}
