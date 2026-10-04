"use client";

import { useRef, useState, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerformanceMonitor, View } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { gsap } from "@/lib/gsap";
import Field, { type FieldControls } from "@/components/scene/Field";

type Controls = FieldControls & { cam: [number, number, number] };
import { PRESETS } from "@/components/scene/presets";
import { sceneState, type SceneRoute } from "@/components/scene/state";
import type { QualityPref } from "@/lib/settings/store";

/**
 * Moves the camera and field between route presets. When the route changes,
 * GSAP tweens a plain object of preset values (a camera move across the
 * scene, not a cut), and every frame the camera follows it plus a little
 * cursor parallax. Analysis energy eases in and out the same way.
 */
function Director({ controlsRef, still }: { controlsRef: RefObject<Controls>; still: boolean }) {
  const route = useRef<SceneRoute | null>(null);

  useFrame((state, delta) => {
    const controls = controlsRef.current;
    if (sceneState.route !== route.current) {
      const first = route.current === null;
      route.current = sceneState.route;
      const p = PRESETS[sceneState.route];
      const to = { tilt: p.tilt, intensity: p.intensity, warmth: p.warmth, cx: p.camera[0], cy: p.camera[1], cz: p.camera[2] };
      const proxy = { tilt: controls.tilt, intensity: controls.intensity, warmth: controls.warmth, cx: controls.cam[0], cy: controls.cam[1], cz: controls.cam[2] };
      gsap.to(proxy, {
        ...to,
        duration: first || still ? 0 : 1.6,
        ease: "power3.inOut",
        overwrite: true,
        onUpdate: () => {
          controls.tilt = proxy.tilt;
          controls.intensity = proxy.intensity;
          controls.warmth = proxy.warmth;
          controls.cam[0] = proxy.cx;
          controls.cam[1] = proxy.cy;
          controls.cam[2] = proxy.cz;
        },
      });
    }

    const dt = Math.min(delta, 0.1);
    controls.energy += (sceneState.energy - controls.energy) * Math.min(1, dt * 3);

    const cam = state.camera;
    const px = still ? 0 : sceneState.pointer.x * 1.2;
    const py = still ? 0 : -sceneState.pointer.y * 0.8;
    const k = still ? 1 : Math.min(1, dt * 3);
    cam.position.x += (controls.cam[0] + px - cam.position.x) * k;
    cam.position.y += (controls.cam[1] + py - cam.position.y) * k;
    cam.position.z += (controls.cam[2] - cam.position.z) * k;
    cam.lookAt(0, 0, 0);
  });
  return null;
}

/**
 * The one WebGL canvas the whole app shares, fixed behind every page. Pages
 * that want their own 3D panels render them through drei <View> into this
 * same canvas (see SceneView), so the app never holds more than one WebGL
 * context.
 */
export default function SceneCanvas({ quality, still }: { quality: QualityPref; still: boolean }) {
  const [declined, setDeclined] = useState(false);
  const low = quality === "low" || (quality === "auto" && declined);
  // Mutated every frame by Director and read by Field: a ref, not render state.
  const [initialPreset] = useState(() => PRESETS[sceneState.route]);
  const controlsRef = useRef<Controls>({
    tilt: initialPreset.tilt,
    intensity: initialPreset.intensity,
    warmth: initialPreset.warmth,
    energy: 0,
    cam: [...initialPreset.camera],
  });
  const eventSource = useRef<HTMLElement>(typeof document !== "undefined" ? document.documentElement : null!);

  return (
    <Canvas
      dpr={low ? 1 : [1, 1.75]}
      gl={{ antialias: false, alpha: true, powerPreference: low ? "low-power" : "high-performance" }}
      camera={{ fov: 42, position: initialPreset.camera, near: 0.1, far: 80 }}
      eventSource={eventSource}
      className="!pointer-events-none"
      style={{ position: "fixed", inset: 0 }}
    >
      {quality === "auto" && <PerformanceMonitor onDecline={() => setDeclined(true)} />}
      <Director controlsRef={controlsRef} still={still} />
      <Field controlsRef={controlsRef} still={still} />
      {!low && (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur luminanceThreshold={0.35} luminanceSmoothing={0.3} intensity={0.6} />
        </EffectComposer>
      )}
      <View.Port />
    </Canvas>
  );
}
