import { notFound } from "next/navigation";
import AvatarLab from "@/components/studio/AvatarLab";

// Development tool: /avatar-lab?shot=<avatar id> renders one default avatar; screenshot #avatar-shot (512×512) and save it as public/avatars/<id>.webp. Never served in production.
export default async function AvatarLabPage({ searchParams }: { searchParams: Promise<{ shot?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { shot } = await searchParams;
  return <AvatarLab shot={typeof shot === "string" ? shot : "halcyon-knob"} />;
}
