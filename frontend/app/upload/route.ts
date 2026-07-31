import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin, SONGS_BUCKET } from "@/lib/supabase";

const ALLOWED_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
];
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Sign in to upload a song." },
      { status: 401 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const durationSec = formData.get("durationSec");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload MP3, WAV, or FLAC." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large (50MB max)." },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop() ?? "mp3";
  const path = `${session.user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(SONGS_BUCKET)
    .upload(path, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  const { data: publicUrl } = supabaseAdmin.storage
    .from(SONGS_BUCKET)
    .getPublicUrl(path);

  // Best-effort "Artist - Title" parse from the filename; the real
  // metadata pass happens in Phase 6 alongside the audio analysis.
  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
  const [maybeArtist, maybeTitle] = nameWithoutExt.split(/\s*-\s*/, 2);

  const song = await prisma.song.create({
    data: {
      userId: session.user.id,
      title: maybeTitle ?? nameWithoutExt,
      artist: maybeTitle ? maybeArtist : null,
      fileUrl: publicUrl.publicUrl,
      durationSec: durationSec ? Number(durationSec) : null,
      sourceType: "UPLOAD",
      status: "UPLOADED",
    },
  });

  return NextResponse.json({ song }, { status: 201 });
}
