import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/utils/prisma";
import type { Adapter } from "next-auth/adapters";
import type { Role } from "@prisma/client";
import "@/lib/auth/types";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,
  session: {
    strategy: "database",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  events: {
    async createUser({ user }) {
      // Set role dari whitelist saat user baru dibuat
      if (user.email) {
        const whitelist = await prisma.whitelistEmail.findUnique({
          where: { email: user.email },
        });

        if (whitelist) {
          await prisma.user.update({
            where: { email: user.email },
            data: { role: whitelist.role },
          });
        }
      }
    },
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) {
        return false;
      }

      // Cek apakah user sudah ada di database
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      // Jika user sudah ada, allow login (tidak perlu cek whitelist lagi)
      if (existingUser) {
        return true;
      }

      // Jika user baru, cek apakah email ada di whitelist
      const whitelist = await prisma.whitelistEmail.findUnique({
        where: { email: user.email },
      });

      if (!whitelist) {
        return false; // Block jika tidak ada di whitelist
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role: Role }).role;
      }
      return session;
    },
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
};

