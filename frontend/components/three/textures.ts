import * as THREE from "three";

/**
 * Every surface on the amp is drawn here at runtime: no image downloads, no
 * third-party assets. Callers own the returned textures and must dispose them.
 */

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

// Deterministic noise so the amp looks the same on every load.
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

function finish(c: HTMLCanvasElement, { repeat = [1, 1] as [number, number], color = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pebbled tolex: a bump map of soft random grain. */
export function tolexBump() {
  const { c, g } = canvas(256, 256);
  const r = rng(7);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const v = Math.floor(90 + r() * 90);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    g.arc(r() * 256, r() * 256, 0.6 + r() * 1.6, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c, { repeat: [5, 2], color: false });
}

/** Woven speaker cloth: charcoal weave with sparse copper thread, plus its glow mask. */
export function grilleCloth() {
  const size = 256;
  const { c, g } = canvas(size, size);
  const r = rng(21);
  g.fillStyle = "#0b0c0e";
  g.fillRect(0, 0, size, size);
  const step = 4;
  for (let y = 0; y < size; y += step) {
    for (let x = 0; x < size; x += step) {
      const over = ((x + y) / step) % 2 === 0;
      const copper = r() < 0.025;
      const base = copper ? [96, 58, 34] : [34 + r() * 8, 33 + r() * 7, 34 + r() * 7];
      g.fillStyle = `rgb(${base.map((v) => Math.round(v * (over ? 1.15 : 0.8))).join(",")})`;
      g.fillRect(x + 0.5, y + 0.5, step - 1, step - 1);
    }
  }
  return finish(c, { repeat: [7, 2] });
}

/** Where the tubes sit behind the cloth; multiplied by gain at render time. */
export function tubeGlowMask(tubes: number) {
  const { c, g } = canvas(512, 128);
  g.fillStyle = "#000";
  g.fillRect(0, 0, 512, 128);
  // A low wash across the cloth, then a soft column of light behind each tube.
  const wash = g.createRadialGradient(256, 90, 10, 256, 90, 300);
  wash.addColorStop(0, "rgba(255,170,100,0.35)");
  wash.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = wash;
  g.fillRect(0, 0, 512, 128);
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < tubes; i++) {
    const x = 512 * (0.5 + (i - (tubes - 1) / 2) * 0.12);
    g.save();
    g.translate(x, 84);
    g.scale(0.7, 1.25);
    const grad = g.createRadialGradient(0, 0, 1, 0, 0, 58);
    grad.addColorStop(0, "rgba(255,190,130,0.55)");
    grad.addColorStop(0.4, "rgba(255,130,60,0.22)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(-80, -80, 160, 160);
    g.restore();
  }
  return finish(c);
}

/**
 * The control panel: brushed gunmetal, engraved labels and a 0–10 scale
 * printed around each knob position (u = 0..1 across the panel).
 */
export function controlPanel({ labels, positions, model, font }: { labels: string[]; positions: number[]; model: string; font: string }) {
  const W = 2048;
  const H = 320;
  const { c, g } = canvas(W, H);
  const r = rng(3);
  const base = g.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#40454e");
  base.addColorStop(0.5, "#30343b");
  base.addColorStop(1, "#24272d");
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // Brushing: thousands of faint horizontal strokes.
  for (let i = 0; i < 2600; i++) {
    const y = r() * H;
    g.strokeStyle = `rgba(255,255,255,${0.012 + r() * 0.03})`;
    g.lineWidth = 0.6 + r();
    g.beginPath();
    g.moveTo(r() * W, y);
    g.lineTo(r() * W, y + (r() - 0.5) * 0.6);
    g.stroke();
  }
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.lineWidth = 6;
  g.strokeRect(3, 3, W - 6, H - 6);

  const cy = H * 0.46;
  const radius = 120;
  g.textAlign = "center";
  g.textBaseline = "middle";
  positions.forEach((u, i) => {
    const cx = u * W;
    for (let t = 0; t <= 10; t++) {
      const a = (-225 + (t / 10) * 270) * (Math.PI / 180);
      const major = t % 5 === 0;
      g.strokeStyle = major ? "rgba(255,170,110,0.95)" : "rgba(243,239,232,0.55)";
      g.lineWidth = major ? 5 : 3;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (radius - (major ? 14 : 8)), cy + Math.sin(a) * (radius - (major ? 14 : 8)));
      g.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      g.stroke();
      if (t !== 5 && major) {
        g.fillStyle = "rgba(243,239,232,0.6)";
        g.font = `500 24px ${font}`;
        g.fillText(String(t), cx + Math.cos(a) * (radius + 20), cy + Math.sin(a) * (radius + 20));
      }
    }
    g.fillStyle = "#f1e6d6";
    g.font = `500 36px ${font}`;
    g.fillText(labels[i].split("").join(String.fromCharCode(8202)), cx, H - 28);
  });

  g.textAlign = "left";
  g.fillStyle = "#ff8a3d";
  g.font = `600 58px ${font}`;
  g.fillText("RESONIQ", 64, cy - 26);
  g.fillStyle = "rgba(243,239,232,0.7)";
  // Long model names shrink to fit the space left of the first knob.
  const name = model.toUpperCase().slice(0, 40);
  let size = 30;
  do {
    g.font = `500 ${size--}px ${font}`;
  } while (size > 16 && g.measureText(name).width > positions[0] * W - 190);
  g.fillText(name, 64, cy + 26);
  g.fillStyle = "rgba(243,239,232,0.45)";
  g.font = `500 20px ${font}`;
  g.textAlign = "right";
  g.fillText("POWER", W - 150, H - 28);
  return finish(c);
}
