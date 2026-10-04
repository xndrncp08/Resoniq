"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import type { MotionValue } from "motion/react";
import * as THREE from "three";
import type { WindowStoreApi } from "@/lib/studio/window-store";

/**
 * The 3D layer behind Studio's windows in spatial mode: a field of points
 * rippling like a vibrating surface. Everything moves in the vertex
 * shader, so the CPU work per frame is a handful of uniform writes.
 *
 * - Ripples follow the cursor; the surface swells under every open window
 *   and most under the focused one (window rects come from the store each
 *   frame, without React renders).
 * - Lit by a directional light that drifts toward the focused window,
 *   shaded from the surface's analytic normal.
 * - The camera eases toward the cursor for parallax.
 * - Bloom on top; drei's PerformanceMonitor drops bloom and resolution if
 *   the frame rate falls, before the windows feel it.
 */

const COLS = 160;
const ROWS = 80;
const MAX_WINDOWS = 24;
const FIELD_W = 30;
const FIELD_H = 15;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform vec4 uWindows[${MAX_WINDOWS}];
  uniform int uCount;
  uniform vec4 uFocus;
  uniform vec3 uLight;
  uniform float uPixelRatio;

  attribute vec2 aGrid;

  varying float vLight;
  varying float vHeat;

  float rectMask(vec2 p, vec4 r) {
    vec2 lo = smoothstep(r.xy - 0.03, r.xy + 0.02, p);
    vec2 hi = 1.0 - smoothstep(r.zw - 0.02, r.zw + 0.03, p);
    return lo.x * lo.y * hi.x * hi.y;
  }

  // Height of the surface at grid coordinate p (0..1 on both axes).
  float heightAt(vec2 p, out float heat) {
    vec2 w = vec2(${FIELD_W.toFixed(1)}, ${FIELD_H.toFixed(1)}) * (p - 0.5);
    float h = sin(w.x * 0.55 + uTime * 0.6) * 0.16 + sin(w.y * 0.8 - uTime * 0.45) * 0.12;
    float d = distance(p * vec2(2.0, 1.0), uPointer * vec2(2.0, 1.0));
    h += exp(-d * d * 18.0) * sin(d * 40.0 - uTime * 4.0) * 0.35;
    heat = 0.0;
    for (int i = 0; i < ${MAX_WINDOWS}; i++) {
      if (i >= uCount) break;
      heat += rectMask(p, uWindows[i]) * 0.35;
    }
    heat += rectMask(p, uFocus) * 0.65;
    h += heat * (0.5 + 0.08 * sin(uTime * 2.0 + w.x));
    return h;
  }

  void main() {
    float heat;
    float h = heightAt(aGrid, heat);
    float hx; float hy;
    float e = 0.004;
    float h1 = heightAt(aGrid + vec2(e, 0.0), hx);
    float h2 = heightAt(aGrid + vec2(0.0, e), hy);
    vec3 normal = normalize(vec3(-(h1 - h) / (e * ${FIELD_W.toFixed(1)}), -(h2 - h) / (e * ${FIELD_H.toFixed(1)}), 1.0));
    vLight = max(dot(normal, normalize(uLight)), 0.0);
    vHeat = clamp(heat, 0.0, 1.0);

    vec3 pos = vec3((aGrid.x - 0.5) * ${FIELD_W.toFixed(1)}, (aGrid.y - 0.5) * ${FIELD_H.toFixed(1)}, h);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.6 + vHeat * 2.2 + vLight * 1.2) * uPixelRatio * (12.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uCool;
  uniform vec3 uWarm;
  varying float vLight;
  varying float vHeat;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float edge = smoothstep(0.5, 0.15, r);
    vec3 color = mix(uCool, uWarm, vHeat) * (0.25 + 1.1 * vLight) + vHeat * 0.35;
    gl_FragColor = vec4(color, edge * (0.28 + 0.55 * vLight + 0.4 * vHeat));
  }
`;

type Pointer = { x: MotionValue<number>; y: MotionValue<number> };

function Field({ store, pointer, still }: { store: WindowStoreApi; pointer: Pointer; still: boolean }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const dpr = useThree((s) => s.viewport.dpr);
  const lastWindows = useRef<unknown>(null);
  const lastViewport = useRef<unknown>(null);
  const light = useRef(new THREE.Vector3(-0.4, 0.5, 1));

  const geometry = useMemo(() => {
    const grid = new Float32Array(COLS * ROWS * 2);
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        grid[(j * COLS + i) * 2] = i / (COLS - 1);
        grid[(j * COLS + i) * 2 + 1] = j / (ROWS - 1);
      }
    const g = new THREE.BufferGeometry();
    // Positions are computed in the shader; three still wants the attribute.
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(COLS * ROWS * 3), 3));
    g.setAttribute("aGrid", new THREE.BufferAttribute(grid, 2));
    // Static vertices plus shader displacement: give it bounds that never cull.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FIELD_W);
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uWindows: { value: Array.from({ length: MAX_WINDOWS }, () => new THREE.Vector4()) },
      uCount: { value: 0 },
      uFocus: { value: new THREE.Vector4(-1, -1, -1, -1) },
      uLight: { value: new THREE.Vector3(-0.4, 0.5, 1) },
      uPixelRatio: { value: 1 },
      uCool: { value: new THREE.Color("#37E6C9") },
      uWarm: { value: new THREE.Color("#FF8A3D") },
    }),
    [],
  );

  useFrame((state, delta) => {
    const u = material.current?.uniforms;
    if (!u) return;
    if (!still) u.uTime.value += Math.min(delta, 0.1);
    u.uPixelRatio.value = dpr;

    // Pointer: -1..1 from the DOM, flipped to the field's 0..1 grid space.
    u.uPointer.value.set(pointer.x.get() * 0.5 + 0.5, -pointer.y.get() * 0.5 + 0.5);

    // Window rects only change when the store does; skip the rebuild otherwise.
    const { windows, viewport, focusedId } = store.getState();
    if (windows !== lastWindows.current || viewport !== lastViewport.current) {
      lastWindows.current = windows;
      lastViewport.current = viewport;
      const toRect = (w: { x: number; y: number; width: number; height: number }, out: THREE.Vector4) =>
        out.set(w.x / viewport.width, 1 - (w.y + w.height) / viewport.height, (w.x + w.width) / viewport.width, 1 - w.y / viewport.height);
      let n = 0;
      for (const w of Object.values(windows)) {
        if (w.isMinimized || w.id === focusedId || n >= MAX_WINDOWS) continue;
        toRect(w, u.uWindows.value[n++]);
      }
      u.uCount.value = n;
      const f = focusedId ? windows[focusedId] : null;
      if (f && !f.isMinimized) {
        toRect(f, u.uFocus.value);
        // Light drifts toward the focused window, from in front.
        const cx = (f.x + f.width / 2) / viewport.width - 0.5;
        const cy = 0.5 - (f.y + f.height / 2) / viewport.height;
        light.current.set(cx * 1.6, cy * 1.6, 1);
      } else {
        u.uFocus.value.set(-1, -1, -1, -1);
      }
    }
    u.uLight.value.lerp(light.current, still ? 1 : Math.min(1, delta * 2));

    // Parallax: the camera eases toward the cursor and keeps looking at the field.
    if (!still) {
      const cam = state.camera;
      cam.position.x += (pointer.x.get() * 1.2 - cam.position.x) * Math.min(1, delta * 3);
      cam.position.y += (-pointer.y.get() * 0.8 - 1.5 - cam.position.y) * Math.min(1, delta * 3);
      cam.lookAt(0, 0, 0);
    }
  });

  return (
    <points geometry={geometry} rotation={[-0.42, 0, 0]}>
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function SpatialScene({ store, pointer, still }: { store: WindowStoreApi; pointer: Pointer; still: boolean }) {
  const [degraded, setDegraded] = useState(false);
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <Canvas
        dpr={degraded ? 1 : [1, 1.75]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        camera={{ fov: 42, position: [0, -1.5, 13], near: 0.1, far: 60 }}
      >
        <PerformanceMonitor onDecline={() => setDegraded(true)} />
        <Field store={store} pointer={pointer} still={still} />
        {!degraded && (
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur luminanceThreshold={0.35} luminanceSmoothing={0.3} intensity={0.7} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
