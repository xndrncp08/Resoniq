import { redirect } from "next/navigation";
import { getActor, type Actor } from "@/lib/authz";

/** For pages: the signed-in, non-banned actor, or a redirect to /login that comes back to `path`. */
export async function requirePageActor(path: string): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect(`/login?callbackUrl=${encodeURIComponent(path)}`);
  if (actor.status === "BANNED") redirect("/login?error=account_disabled");
  return actor;
}

/** For pages: the signed-in user's id (see requirePageActor). */
export async function requirePageUserId(path: string): Promise<string> {
  return (await requirePageActor(path)).id;
}
