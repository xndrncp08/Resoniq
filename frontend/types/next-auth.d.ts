import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** The user's sessionVersion when this session was issued. */
      sv?: number;
    } & DefaultSession["user"];
  }
}