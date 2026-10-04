import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** For pages: the signed-in user's id, or a redirect to /login that comes back to `path`. */
export async function requirePageUserId(path: string): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect(`/login?callbackUrl=${encodeURIComponent(path)}`);
  return id;
}
