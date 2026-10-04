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

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
