import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    /** Credentials must retain the version read with the password hash. */
    sv?: number;
    /** Set from Google's email_verified claim when an OAuth account is created. */
    emailVerified?: Date | null;
  }
  interface Session {
    user: {
      id: string;
      /** The user's sessionVersion when this session was issued. */
      sv?: number;
    } & DefaultSession["user"];
  }
}
