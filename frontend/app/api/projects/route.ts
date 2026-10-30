import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { requireActor } from "@/lib/authz";
import { listProjects } from "@/lib/projects";

export const GET = route("projects.list", async () => {
  const actor = await requireActor();
  return NextResponse.json({ projects: await listProjects(actor.id) });
});
