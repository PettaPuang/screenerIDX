import { prisma } from "@/lib/utils/prisma";
import type { Role } from "@prisma/client";

export async function getWhitelistEmails() {
  return await prisma.whitelistEmail.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function getWhitelistEmailById(id: string) {
  return await prisma.whitelistEmail.findUnique({
    where: { id },
  });
}

export async function getWhitelistEmailByEmail(email: string) {
  return await prisma.whitelistEmail.findUnique({
    where: { email },
  });
}

