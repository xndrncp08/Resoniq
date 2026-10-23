import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { compareAgainstDummy, normalizeEmail } from "@/lib/credentials";
import { checkRateLimit, clientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { isEnabled } from "@/lib/flags";
import { googleCredentials } from "@/lib/hosting";
import { isReservedDisplayName } from "@/lib/system-identity";

class RateLimited extends CredentialsSignin {
  code = "rate_limited";
}

class AccountDisabled extends CredentialsSignin {
  code = "account_disabled";
}

const google = googleCredentials();
export const googleEnabled = !!google;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    // OAuth failures (unlinked account, refused sign-in) land on /login?error=… too.
    error: "/login",
  },
  providers: [
    ...(google
      ? [
          // No allowDangerousEmailAccountLinking: a Google sign-in whose email
          // already belongs to another account is refused (OAuthAccountNotLinked)
          // rather than merged, so a matching email alone never grants access.
          Google({
            ...google,
            checks: ["pkce", "state"],
            profile: (p) => ({
              id: p.sub,
              // A Google name can't make a member look like Resoniq's own identity.
              name: p.name && !isReservedDisplayName(p.name) ? p.name : null,
              email: p.email,
              image: p.picture,
              emailVerified: p.email_verified ? new Date() : null,
            }),
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
        if (!(await checkRateLimit("signin-ip", ip, RATE_LIMITS.signIn)).ok || !(await checkRateLimit("signin-email", email, RATE_LIMITS.signIn)).ok) {
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
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        // Only addresses Google has verified may create or reach an account.
        if (profile?.email_verified !== true) return "/login?error=email_unverified";
        const linked = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } },
          select: { userId: true },
        });
        if (!linked && !(await isEnabled("signups"))) return "/login?error=signups_closed";
      }
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
