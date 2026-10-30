import type { Metadata } from "next";
import { PageHeader } from "@/components/app/ui";
import ProjectList from "@/components/projects/ProjectList";
import { listProjects } from "@/lib/projects";
import { requirePageUserId } from "@/lib/session";

export const metadata: Metadata = { title: "Projects", robots: { index: false } };

export default async function ProjectsPage() {
  const userId = await requirePageUserId("/projects");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow="Music projects" title="Projects">Everything you&apos;re making with other people, from the first riff to release.</PageHeader>
      <ProjectList userId={userId} initial={await listProjects(userId)} />
    </div>
  );
}
