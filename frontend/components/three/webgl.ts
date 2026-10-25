let cached: boolean | undefined;

/** Whether this browser can create a WebGL context. Probes once, then frees the probe context. */
export function webglAvailable(): boolean {
  if (cached !== undefined) return cached;
  try {
    const gl = document.createElement("canvas").getContext("webgl2") ?? document.createElement("canvas").getContext("webgl");
    cached = !!gl;
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

export type Scene3dDecision = "render" | "hidden" | "unsupported";

/** 3D is an enhancement: the HTML controls beside it always do the same job. */
export function decideScene3d(pref: "auto" | "off", supported: boolean): Scene3dDecision {
  if (!supported) return "unsupported";
  return pref === "off" ? "hidden" : "render";
}
