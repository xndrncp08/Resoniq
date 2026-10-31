import { ImageResponse } from "next/og";
import { getPost } from "@/lib/posts";
import { getTone } from "@/lib/tones";
import { CARD_FORMATS, ToneCard, type CardFormat } from "@/lib/tone-card";
import { patchFromTone } from "@/lib/studio/from-tone";
import { dnaFromPatch } from "@/lib/tone-dna";
import { releaseFacts } from "@/lib/publishing";
import { getPublicProfile } from "@/lib/profiles";
import { INSTRUMENT_LABEL, type Instrument } from "@/lib/instruments";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ kind: string; id: string }> };

const C = { bg: "#0A0D12", panel: "#151A22", line: "#343D4C", ink: "#F3EFE8", muted: "#8B93A1", copper: "#FF8A3D", signal: "#37E6C9" };

function Frame({ eyebrow, title, by, chips, peaks }: { eyebrow: string; title: string; by: string; chips: { text: string; color: string }[]; peaks?: number[] | null }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: `radial-gradient(circle at 12% 18%, #3A2214, ${C.bg} 55%)`, color: C.ink, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, border: `8px solid ${C.ink}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, background: C.copper }} />
        </div>
        <div style={{ fontSize: 34, letterSpacing: 6, fontWeight: 700 }}>RESONIQ</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 26, letterSpacing: 5, color: C.copper }}>{eyebrow}</div>
        <div style={{ fontSize: title.length > 40 ? 64 : 80, fontWeight: 700, lineHeight: 1.02, maxWidth: 1000 }}>{title}</div>
        <div style={{ fontSize: 32, color: C.muted }}>{by}</div>
      </div>
      {/* A release's real waveform (its stored peaks), drawn as bars. */}
      {peaks && peaks.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, height: 90 }}>
          {bars(peaks, 72).map((v, i) => <div key={i} style={{ width: 10, height: Math.max(6, v * 90), borderRadius: 4, background: C.copper, opacity: 0.85 }} />)}
        </div>
      )}
      <div style={{ display: "flex", gap: 14 }}>
        {chips.map((c) => (
          <div key={c.text} style={{ display: "flex", padding: "10px 22px", borderRadius: 999, border: `2px solid ${c.color}`, color: c.color, fontSize: 24 }}>{c.text}</div>
        ))}
      </div>
    </div>
  );
}

/** Downsample peaks to `n` bars by taking each bucket's maximum, normalised to 0..1. */
function bars(peaks: number[], n: number) {
  const len = Math.min(n, peaks.length);
  const out = Array.from({ length: len }, (_, i) => Math.max(...peaks.slice(Math.floor((i * peaks.length) / len), Math.floor(((i + 1) * peaks.length) / len)), 0));
  const top = Math.max(...out, 1e-6);
  return out.map((v) => v / top);
}

/** Social preview images for shared tones and posts. Only content anyone may already see is rendered. */
export async function GET(req: Request, { params }: Ctx) {
  const { kind, id } = await params;
  const headers = { "Cache-Control": "public, max-age=600, s-maxage=600" };
  if (kind === "card") {
    // A shareable settings card. Same rule as previews: only what anyone with the link may see (no private tones).
    const t = await getTone(id, null);
    if (!t) return new Response("Not found", { status: 404 });
    const url = new URL(req.url);
    const format = (url.searchParams.get("format") ?? "square") as CardFormat;
    if (!(format in CARD_FORMATS)) return new Response("Unknown format", { status: 400 });
    const opened = patchFromTone(t);
    const download = url.searchParams.get("download") === "1";
    return new ImageResponse(
      <ToneCard format={format} name={t.name} by={t.anonymous ? t.author.name ?? "Resoniq" : `@${t.author.handle}`} patch={opened.patch} from={opened.from} dna={dnaFromPatch(opened.patch)} url={`${url.origin}/t/${t.id}`} device={opened.device?.name ?? null} />,
      { ...CARD_FORMATS[format], headers: { ...headers, ...(download && { "Content-Disposition": `attachment; filename="${t.name.replace(/[^\w-]+/g, "-").toLowerCase()}-${format}.png"` }) } },
    );
  }
  if (kind === "tone") {
    const t = await getTone(id, null);
    if (!t) return new Response("Not found", { status: 404 });
    const chain = t.declared ? [t.declared.instrument?.ref?.model, ...t.declared.chain.map((b) => b.ref?.model ?? b.category), t.declared.amp?.ref?.model].filter(Boolean).slice(0, 4).join("  →  ") : null;
    return new ImageResponse(
      <Frame
        eyebrow={t.origin === "generated" ? "SUGGESTED SETTINGS · RESONIQ-GENERATED" : t.declared ? "CREATOR-DECLARED RIG" : "TONE RECIPE · INFERRED FROM AUDIO"}
        title={t.name}
        by={`${t.anonymous ? t.author.name : `@${t.author.handle}`}${chain ? `  ·  ${chain}` : ""}`}
        chips={[...(t.origin === "generated" ? [{ text: "Resoniq-generated", color: C.ink }] : t.declared ? [{ text: "Creator declared", color: C.copper }] : []), ...(t.inferred ? [{ text: "Resoniq inferred", color: C.signal }] : [])]}
      />,
      { width: 1200, height: 630, headers },
    );
  }
  if (kind === "post") {
    const p = await getPost(id, null);
    if (!p) return new Response("Not found", { status: 404 });
    if (p.release) {
      const facts = releaseFacts(p.release);
      return new ImageResponse(
        <Frame eyebrow="NEW MUSIC ON RESONIQ" title={p.title ?? p.release.title} by={facts.credits || (p.author.name ?? `@${p.author.handle}`)} chips={facts.chips.map((text) => ({ text, color: C.ink }))} peaks={p.release.takes[0]?.peaks} />,
        { width: 1200, height: 630, headers },
      );
    }
    return new ImageResponse(
      <Frame eyebrow={p.community ? `C/${p.community.slug.toUpperCase()}` : p.category.replace(/_/g, " ")} title={p.title ?? (p.body.slice(0, 90) || "A post on Resoniq")} by={`${p.author.name ?? `@${p.author.handle}`}`} chips={[...(p.media.some((m) => m.kind === "VIDEO") ? [{ text: "Video", color: C.ink }] : []), ...(p.tone ? [{ text: "Rig attached", color: C.copper }] : [])]} />,
      { width: 1200, height: 630, headers },
    );
  }
  if (kind === "musician") {
    // Same public fields the profile page shows to a signed-out visitor.
    const u = await getPublicProfile(id, null);
    if (!u) return new Response("Not found", { status: 404 });
    const releases = await prisma.post.count({ where: { authorId: u.id, category: "ORIGINAL", status: "PUBLISHED", communityId: null } });
    const plays = u.instruments.map((i) => INSTRUMENT_LABEL[i as Instrument] ?? i).slice(0, 3);
    return new ImageResponse(
      <Frame eyebrow={plays.length ? plays.join(" · ").toUpperCase() : "MUSICIAN"} title={u.name ?? `@${u.handle}`} by={`@${u.handle}${releases ? `  ·  ${releases} release${releases === 1 ? "" : "s"}` : ""}`} chips={u.genres.slice(0, 4).map((g) => ({ text: g, color: C.ink }))} />,
      { width: 1200, height: 630, headers },
    );
  }
  return new Response("Not found", { status: 404 });
}
