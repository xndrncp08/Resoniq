let cached: { available: boolean; software: boolean } | undefined;

// Renderers that draw on the CPU: no GPU, hardware acceleration off, or a VM. Every 3D frame costs the main thread.
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

function probe() {
  if (cached) return cached;
  try {
    const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = gl ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "") : "";
    cached = { available: !!gl, software: SOFTWARE.test(renderer) };
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = { available: false, software: false };
  }
  return cached;
}

/** Whether this browser can create a WebGL context. Probes once, then frees the probe context. */
export const webglAvailable = () => probe().available;

/**
 * Devices where 3D should wait to be asked for: software WebGL, Data Saver,
 * or little memory. The 2D controls do the same job without the cost.
 */
export function lowPowerDevice(): boolean {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  return probe().software || !!nav.connection?.saveData || (nav.deviceMemory !== undefined && nav.deviceMemory < 4);
}

export type Scene3dDecision = "render" | "hidden" | "unsupported" | "on-request";

/**
 * 3D is an enhancement: the HTML controls beside it always do the same job.
 * "auto" renders on capable devices and waits to be asked on low-power ones;
 * "on" (chosen by tapping Show 3D) renders anywhere that supports WebGL.
 */
export function decideScene3d(pref: "auto" | "on" | "off", supported: boolean, lowPower = false): Scene3dDecision {
  if (!supported) return "unsupported";
  if (pref === "off") return "hidden";
  return pref === "auto" && lowPower ? "on-request" : "render";
}
