import * as THREE from "three";

/**
 * Procedural surfaces for the studio's equipment, painted on canvases at
 * runtime: no downloaded images or models. Callers own (and dispose) the
 * textures they get back.
 */

export function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

export function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

export function texture(c: HTMLCanvasElement, { repeat = [1, 1] as [number, number], color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pebbled or leather-grain tolex as a bump map. */
export function tolexBump(kind: "pebble" | "leather" | "smooth", seed = 5) {
  const { c, g } = canvas(512, 512);
  const r = rng(seed);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 512, 512);
  if (kind === "smooth") {
    for (let i = 0; i < 3000; i++) {
      const v = 120 + r() * 20;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(r() * 512, r() * 512, 1, 1);
    }
  } else if (kind === "pebble") {
    for (let i = 0; i < 9000; i++) {
      const v = Math.floor(95 + r() * 80);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.beginPath();
      g.arc(r() * 512, r() * 512, 1 + r() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // Leather: irregular cells separated by darker creases.
    for (let i = 0; i < 1600; i++) {
      const x = r() * 512;
      const y = r() * 512;
      const s = 4 + r() * 9;
      g.fillStyle = `rgb(${150 + r() * 30},${150 + r() * 30},${150 + r() * 30})`;
      g.beginPath();
      g.ellipse(x, y, s, s * (0.6 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = "rgba(40,40,40,0.5)";
    for (let i = 0; i < 700; i++) {
      g.lineWidth = 0.6 + r();
      g.beginPath();
      const x = r() * 512;
      const y = r() * 512;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + (r() - 0.5) * 20, y + (r() - 0.5) * 20, x + (r() - 0.5) * 30, y + (r() - 0.5) * 30);
      g.stroke();
    }
  }
  return texture(c, { repeat: [3, 2], color: false });
}

/** Woven speaker cloth for the cabinet. */
export function cloth(base: [number, number, number], seed = 11) {
  const size = 256;
  const { c, g } = canvas(size, size);
  const r = rng(seed);
  for (let y = 0; y < size; y += 3) {
    for (let x = 0; x < size; x += 3) {
      const over = ((x + y) / 3) % 2 === 0;
      const k = (over ? 1.18 : 0.78) * (0.9 + r() * 0.2);
      g.fillStyle = `rgb(${base.map((v) => Math.min(255, Math.round(v * k))).join(",")})`;
      g.fillRect(x, y, 3, 3);
    }
  }
  return texture(c, { repeat: [10, 6] });
}

export type GrilleKind = "lattice" | "hex" | "slats" | "glass" | "kintsugi";

/**
 * The amp's front. Metal grilles return an alpha mask (white = metal) so the
 * tubes show through the gaps; glass returns a frosted relief; kintsugi a
 * lacquer panel with gold veins and their glow mask.
 */
export function front(kind: GrilleKind, seed = 3): { map?: THREE.Texture; alpha?: THREE.Texture; bump?: THREE.Texture; emissive?: THREE.Texture } {
  // Matches the grille opening's proportions (about 4:1), so patterns aren't stretched.
  const W = 1024;
  const H = 256;
  const r = rng(seed);
  if (kind === "lattice") {
    // Interlocking isometric cubes cut from sheet metal: an original take on a laser-cut panel.
    const { c, g } = canvas(W, H);
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#fff";
    g.lineCap = "square";
    const s = 26;
    const h = s * Math.sqrt(3);
    for (let row = -1; row < (2 * H) / h + 2; row++) {
      for (let col = -1; col < W / (s * 3) + 2; col++) {
        const cx = col * s * 3 + (Math.abs(row) % 2 ? s * 1.5 : 0);
        const cy = row * h * 0.5 * 1.0;
        g.lineWidth = 7;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k + Math.PI / 6;
          g[k ? "lineTo" : "moveTo"](cx + s * Math.cos(a), cy + s * Math.sin(a));
        }
        g.closePath();
        g.stroke();
        // Inner chevrons give each hexagon its cube edges.
        g.lineWidth = 5;
        for (let k = 0; k < 3; k++) {
          const a = (Math.PI * 2 * k) / 3 + Math.PI / 2;
          for (let j = 1; j <= 2; j++) {
            g.beginPath();
            g.moveTo(cx, cy);
            g.lineTo(cx + ((s * j) / 3) * Math.cos(a) * 2.6, cy + ((s * j) / 3) * Math.sin(a) * 2.6);
            g.stroke();
          }
        }
      }
    }
    g.lineWidth = 14;
    g.strokeRect(0, 0, W, H);
    return { alpha: texture(c, { color: false }) };
  }
  if (kind === "hex") {
    const { c, g } = canvas(W, H);
    g.fillStyle = "#fff";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#000";
    const s = 14;
    const h = s * Math.sqrt(3);
    for (let row = -1; row < H / h + 2; row++) {
      for (let col = 0; col < W / (s * 1.5) + 2; col++) {
        const cx = col * s * 1.5;
        const cy = row * h + (col % 2 ? h / 2 : 0);
        g.beginPath();
        for (let k = 0; k < 6; k++) g[k ? "lineTo" : "moveTo"](cx + (s - 4) * Math.cos((Math.PI / 3) * k), cy + (s - 4) * Math.sin((Math.PI / 3) * k));
        g.closePath();
        g.fill();
      }
    }
    g.strokeStyle = "#fff";
    g.lineWidth = 16;
    g.strokeRect(0, 0, W, H);
    return { alpha: texture(c, { color: false }) };
  }
  if (kind === "slats") {
    const { c, g } = canvas(W, H);
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#fff";
    for (let y = 16; y < H - 16; y += 16) {
      g.beginPath();
      g.roundRect(26, y, W - 52, 8, 4);
      g.fill();
    }
    g.fillRect(0, 0, W, 14);
    g.fillRect(0, H - 14, W, 14);
    g.fillRect(0, 0, 18, H);
    g.fillRect(W - 18, 0, 18, H);
    return { alpha: texture(c, { color: false }) };
  }
  if (kind === "glass") {
    // Frosted glass in irregular cells: a relief map from Voronoi edges.
    const { c, g } = canvas(512, 128);
    const pts = Array.from({ length: 60 }, () => [r() * 512, r() * 128]);
    const img = g.createImageData(512, 128);
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 512; x++) {
        let d1 = 1e9;
        let d2 = 1e9;
        for (const [px, py] of pts) {
          const d = (px - x) ** 2 + (py - y) ** 2;
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        const edge = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / 9);
        const v = Math.round(60 + 195 * edge);
        const i = (y * 512 + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return { bump: texture(c, { color: false }) };
  }
  // Kintsugi: black lacquer mended with gold seams.
  const { c, g } = canvas(W, H);
  const lac = g.createLinearGradient(0, 0, W, H);
  lac.addColorStop(0, "#15110f");
  lac.addColorStop(0.5, "#221a17");
  lac.addColorStop(1, "#110d0c");
  g.fillStyle = lac;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(255,240,220,${r() * 0.03})`;
    g.fillRect(r() * W, r() * H, 2, 2);
  }
  const glow = canvas(W, H);
  glow.g.fillStyle = "#000";
  glow.g.fillRect(0, 0, W, H);
  const crack = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    for (const target of [g, glow.g]) {
      target.strokeStyle = target === g ? "#d8b46a" : "#fff";
      target.lineWidth = w;
      target.lineCap = "round";
    }
    for (let i = 0; i < len; i++) {
      const nx = x + Math.cos(a) * 9;
      const ny = y + Math.sin(a) * 9;
      for (const target of [g, glow.g]) {
        target.beginPath();
        target.moveTo(x, y);
        target.lineTo(nx, ny);
        target.stroke();
      }
      x = nx;
      y = ny;
      a += (r() - 0.5) * 0.45;
      if (depth < 2 && r() < 0.025) crack(x, y, a + (r() < 0.5 ? 0.8 : -0.8), len / 2.5, Math.max(1.4, w * 0.55), depth + 1);
    }
  };
  // A few long seams across the lacquer, like a mended bowl.
  for (let i = 0; i < 3; i++) crack(r() * W, r() < 0.5 ? 0 : H, r() < 0.5 ? 0.9 : -0.9, 40 + r() * 30, 5, 0);
  for (let i = 0; i < 3; i++) crack(r() < 0.5 ? 0 : W, r() * H, r() < 0.5 ? 0.15 : Math.PI - 0.15, 55 + r() * 30, 4, 0);
  return { map: texture(c), emissive: texture(glow.c) };
}

export type PanelFinish = { base: [string, string]; brushed: boolean; ink: string; accent: string; divider: string };

export type PanelItem = { u: number; label: string; kind: "knob" | "switch" | "jack" | "power" };

/**
 * A faceplate with every control's label printed where its control sits,
 * a 0–10 scale around each knob and dividers between control groups.
 */
export function faceplate(items: PanelItem[], finish: PanelFinish, logo: string, fonts: { display: string; mono: string }, W = 2048, H = 280) {
  const { c, g } = canvas(W, H);
  const r = rng(9);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, finish.base[0]);
  grad.addColorStop(1, finish.base[1]);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  if (finish.brushed) {
    for (let i = 0; i < 3500; i++) {
      const y = r() * H;
      g.strokeStyle = `rgba(255,255,255,${0.015 + r() * 0.04})`;
      g.lineWidth = 0.5 + r();
      g.beginPath();
      g.moveTo(r() * W, y);
      g.lineTo(r() * W, y);
      g.stroke();
    }
  }
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 8;
  g.strokeRect(4, 4, W - 8, H - 8);
  const cy = H * 0.56;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let lastKind: PanelItem["kind"] | null = null;
  for (const [i, it] of items.entries()) {
    const cx = it.u * W;
    if (it.kind === "knob") {
      const radius = 70;
      for (let tck = 0; tck <= 10; tck++) {
        const a = (-225 + (tck / 10) * 270) * (Math.PI / 180);
        g.fillStyle = finish.ink;
        g.globalAlpha = 0.75;
        g.font = `500 19px ${fonts.mono}`;
        g.fillText(String(tck), cx + Math.cos(a) * (radius + 16), cy + Math.sin(a) * (radius + 16));
        g.globalAlpha = 1;
      }
    }
    g.fillStyle = finish.ink;
    g.font = `600 25px ${fonts.display}`;
    g.fillText(it.label.toUpperCase().split("").join(String.fromCharCode(8202)), cx, it.kind === "knob" ? H * 0.12 : H * 0.18);
    // A thin divider wherever the panel moves from one group of controls to another.
    const prev = items[i - 1];
    if (prev && lastKind && lastKind !== it.kind) {
      const x = ((prev.u + it.u) / 2) * W;
      g.strokeStyle = finish.divider;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, H * 0.22);
      g.lineTo(x, H * 0.9);
      g.stroke();
    }
    lastKind = it.kind;
  }
  g.textAlign = "right";
  g.fillStyle = finish.accent;
  g.font = `italic 600 46px ${fonts.display}`;
  g.fillText(logo, W - 40, cy);
  return texture(c);
}

/** A pedal's top face: name, knob labels and a little artwork stripe. */
export function pedalFace(name: string, labels: string[], color: string, fonts: { display: string; mono: string }) {
  const { c, g } = canvas(256, 384);
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 384);
  const shade = g.createLinearGradient(0, 0, 0, 384);
  shade.addColorStop(0, "rgba(255,255,255,0.12)");
  shade.addColorStop(1, "rgba(0,0,0,0.25)");
  g.fillStyle = shade;
  g.fillRect(0, 0, 256, 384);
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.textAlign = "center";
  g.font = `600 17px ${fonts.mono}`;
  labels.forEach((l, i) => g.fillText(l.toUpperCase(), (256 / (labels.length + 1)) * (i + 1), 132));
  g.font = `700 30px ${fonts.display}`;
  g.fillText(name, 128, 238);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(24, 262, 208, 3);
  return texture(c);
}
