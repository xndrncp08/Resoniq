import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { compareAgainstDummy, normalizeEmail } from "@/lib/credentials";
import { clientIp, rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

class AccountDisabled extends CredentialsSignin {
  code = "account_disabled";
}

export const googleEnabled = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = normalizeEmail(credentials?.email);
        const password = credentials?.password;
        if (!email || typeof password !== "string" || !password) return null;

        // Per IP and per account, so neither spraying one password across
        // accounts nor hammering one account gets an unbounded budget.
        const ip = clientIp(request);
        if (!rateLimit("signin-ip", ip, RATE_LIMITS.signIn).ok || !rateLimit("signin-email", email, RATE_LIMITS.signIn).ok) {
          throw new RateLimited();
        }

        const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
        if (!user?.passwordHash) {
          await compareAgainstDummy(password);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;
        // Only after the password matches, so this doesn't reveal which emails are banned.
        if (user.status === "BANNED") throw new AccountDisabled();

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          sv: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    // Covers OAuth sign-ins; credentials sign-ins are refused in authorize().
    async signIn({ user }) {
      if (!user.id) return true;
      const found = await prisma.user.findUnique({ where: { id: user.id }, select: { status: true } });
      return found?.status !== "BANNED" || "/login?error=account_disabled";
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Stamp the session with the account's current version; a password reset bumps it.
        if (typeof user.sv === "number") token.sv = user.sv;
        else {
          const row = await prisma.user.findUnique({ where: { id: user.id! }, select: { sessionVersion: true } });
          token.sv = row?.sessionVersion ?? 0;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.sv = typeof token.sv === "number" ? token.sv : 0;
      }
      return session;
    },
  },
});
