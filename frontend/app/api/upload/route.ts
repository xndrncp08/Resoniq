import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin, SONGS_BUCKET } from "@/lib/supabase";

// Keyed by extension: browsers report audio MIME types inconsistently
// (audio/wav vs audio/wave vs audio/vnd.wave vs "", audio/mpeg vs audio/mp3),
// so the extension decides and we store a canonical content type.
const CONTENT_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
};
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to upload a song." }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const durationSec = Number(formData.get("durationSec"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext];
  if (!contentType || (file.type && !file.type.startsWith("audio/"))) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload MP3, WAV, or FLAC." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (50MB max)." }, { status: 400 });
  }

  const path = `${session.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const supabaseAdmin = getSupabaseAdmin();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(SONGS_BUCKET)
    .upload(path, buffer, { contentType });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrl } = supabaseAdmin.storage.from(SONGS_BUCKET).getPublicUrl(path);

  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
  const [maybeArtist, maybeTitle] = nameWithoutExt.split(/\s*-\s*/, 2);

  const song = await prisma.song.create({
    data: {
      userId: session.user.id,
      title: maybeTitle ?? nameWithoutExt,
      artist: maybeTitle ? maybeArtist : null,
      fileUrl: publicUrl.publicUrl,
      durationSec: Number.isFinite(durationSec) && durationSec > 0 ? durationSec : null,
      sourceType: "UPLOAD",
      status: "UPLOADED",
    },
  });

  // The Song row doubles as the analysis job: its status moves
  // UPLOADED -> ANALYZING -> ANALYZED | FAILED via POST /api/analyze.
  return NextResponse.json({ song, analysisJobId: song.id }, { status: 201 });
}
