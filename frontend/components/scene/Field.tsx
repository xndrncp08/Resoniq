"use client";

import { useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { sceneState } from "@/components/scene/state";

/**
 * A field of points rippling like a vibrating surface; everything moves in
 * the vertex shader, so per-frame CPU work is a few uniform writes.
 *
 * Inputs, all read from sceneState each frame:
 * - waves that quicken and grow with analysis energy and live audio (low
 *   band lifts the long waves, highs add shimmer);
 * - a ripple under the cursor;
 * - swells under Studio windows, strongest under the focused one;
 * - a light that drifts toward the focused window.
 * `intensity`, `warmth` and the tilt come from the route preset (Director).
 */

const COLS = 160;
const ROWS = 80;
export const MAX_RECTS = 24;
export const FIELD_W = 30;
export const FIELD_H = 15;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform vec4 uRects[${MAX_RECTS}];
  uniform int uCount;
  uniform vec4 uFocus;
  uniform vec3 uLight;
  uniform float uPixelRatio;
  uniform float uIntensity;
  uniform vec4 uAudio; // level, low, mid, high

  attribute vec2 aGrid;

  varying float vLight;
  varying float vHeat;

  float rectMask(vec2 p, vec4 r) {
    vec2 lo = smoothstep(r.xy - 0.03, r.xy + 0.02, p);
    vec2 hi = 1.0 - smoothstep(r.zw - 0.02, r.zw + 0.03, p);
    return lo.x * lo.y * hi.x * hi.y;
  }

  float heightAt(vec2 p, out float heat) {
    vec2 w = vec2(${FIELD_W.toFixed(1)}, ${FIELD_H.toFixed(1)}) * (p - 0.5);
    float amp = 0.6 + 0.4 * uIntensity + uAudio.y * 0.8;
    float h = (sin(w.x * 0.55 + uTime * 0.6) * 0.16 + sin(w.y * 0.8 - uTime * 0.45) * 0.12) * amp;
    h += sin(w.x * 3.1 + uTime * 5.0) * sin(w.y * 2.7 - uTime * 4.0) * 0.05 * uAudio.w;
    float d = distance(p * vec2(2.0, 1.0), uPointer * vec2(2.0, 1.0));
    h += exp(-d * d * 18.0) * sin(d * 40.0 - uTime * 4.0) * 0.35;
    heat = 0.0;
    for (int i = 0; i < ${MAX_RECTS}; i++) {
      if (i >= uCount) break;
      heat += rectMask(p, uRects[i]) * 0.35;
    }
    heat += rectMask(p, uFocus) * 0.65;
    h += heat * (0.5 + 0.08 * sin(uTime * 2.0 + w.x));
    return h;
  }

  void main() {
    float heat;
    float h = heightAt(aGrid, heat);
    float unused;
    float e = 0.004;
    float h1 = heightAt(aGrid + vec2(e, 0.0), unused);
    float h2 = heightAt(aGrid + vec2(0.0, e), unused);
    vec3 normal = normalize(vec3(-(h1 - h) / (e * ${FIELD_W.toFixed(1)}), -(h2 - h) / (e * ${FIELD_H.toFixed(1)}), 1.0));
    vLight = max(dot(normal, normalize(uLight)), 0.0);
    vHeat = clamp(heat + uAudio.x * 0.25, 0.0, 1.0);

    vec3 pos = vec3((aGrid.x - 0.5) * ${FIELD_W.toFixed(1)}, (aGrid.y - 0.5) * ${FIELD_H.toFixed(1)}, h);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (1.6 + vHeat * 2.2 + vLight * 1.2) * uPixelRatio * (12.0 / -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uCool;
  uniform vec3 uWarm;
  uniform float uWarmth;
  uniform float uIntensity;
  varying float vLight;
  varying float vHeat;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c);
    if (r > 0.5) discard;
    float edge = smoothstep(0.5, 0.15, r);
    vec3 base = mix(uCool, uWarm, clamp(uWarmth + vHeat, 0.0, 1.0));
    vec3 color = base * (0.25 + 1.1 * vLight) + vHeat * 0.35;
    float alpha = edge * (0.22 + 0.5 * vLight + 0.4 * vHeat) * (0.35 + 0.65 * uIntensity);
    gl_FragColor = vec4(color, alpha);
  }
`;

export type FieldControls = { tilt: number; intensity: number; warmth: number; energy: number };

export default function Field({ controlsRef, still }: { controlsRef: RefObject<FieldControls>; still: boolean }) {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const dpr = useThree((s) => s.viewport.dpr);
  const light = useRef(new THREE.Vector3(-0.4, 0.5, 1));
  const audioSmooth = useRef(new THREE.Vector4());

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
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), FIELD_W);
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uRects: { value: Array.from({ length: MAX_RECTS }, () => new THREE.Vector4()) },
      uCount: { value: 0 },
      uFocus: { value: new THREE.Vector4(-1, -1, -1, -1) },
      uLight: { value: new THREE.Vector3(-0.4, 0.5, 1) },
      uPixelRatio: { value: 1 },
      uIntensity: { value: 0.8 },
      uWarmth: { value: 0.2 },
      uAudio: { value: new THREE.Vector4() },
      uCool: { value: new THREE.Color("#37E6C9") },
      uWarm: { value: new THREE.Color("#FF8A3D") },
    }),
    [],
  );

  useFrame((_, delta) => {
    const u = material.current?.uniforms;
    if (!u) return;
    const controls = controlsRef.current;
    const dt = Math.min(delta, 0.1);
    const s = sceneState;
    if (!still) u.uTime.value += dt * (1 + controls.energy * 1.5);
    u.uPixelRatio.value = dpr;
    u.uIntensity.value = Math.min(1, controls.intensity + controls.energy * 0.4);
    u.uWarmth.value = Math.min(1, controls.warmth + controls.energy * 0.3);
    if (points.current) points.current.rotation.x = controls.tilt;

    u.uPointer.value.set(s.pointer.x * 0.5 + 0.5, -s.pointer.y * 0.5 + 0.5);

    const n = Math.min(s.windows.length, MAX_RECTS);
    for (let i = 0; i < n; i++) u.uRects.value[i].set(...s.windows[i]);
    u.uCount.value = n;
    if (s.focus) {
      u.uFocus.value.set(...s.focus);
      const [x0, y0, x1, y1] = s.focus;
      light.current.set(((x0 + x1) / 2 - 0.5) * 1.6, ((y0 + y1) / 2 - 0.5) * 1.6, 1);
    } else {
      u.uFocus.value.set(-1, -1, -1, -1);
      light.current.set(-0.4, 0.5, 1);
    }
    u.uLight.value.lerp(light.current, still ? 1 : Math.min(1, dt * 2));

    // Audio eases toward the live levels: fast attack, slower release.
    const a = s.audio;
    const target = a.playing ? [a.level, a.low, a.mid, a.high] : [0, 0, 0, 0];
    const sm = audioSmooth.current;
    (["x", "y", "z", "w"] as const).forEach((k, i) => {
      const rate = target[i] > sm[k] ? 18 : 4;
      sm[k] += (target[i] - sm[k]) * Math.min(1, dt * rate);
    });
    u.uAudio.value.copy(sm);
  });

  return (
    <points ref={points} geometry={geometry}>
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
