import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe auth config — no Prisma, no bcrypt.
 * Used only by middleware to verify the JWT session cookie.
 * The full config (with Credentials provider) lives in src/server/auth/config.ts
 */
export const authConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname === "/signin" || nextUrl.pathname === "/signup";

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/notes", nextUrl));
        return true;
      }

      if (!isLoggedIn) return Response.redirect(new URL("/signin", nextUrl));
      return true;
    },
  },
} satisfies NextAuthConfig;
