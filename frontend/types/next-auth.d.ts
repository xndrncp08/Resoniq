import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    /** Credentials must retain the version read with the password hash. */
    sv?: number;
  }
  interface Session {
    user: {
      id: string;
      /** The user's sessionVersion when this session was issued. */
      sv?: number;
    } & DefaultSession["user"];
  }
}
