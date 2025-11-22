"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { whitelistEmailSchema } from "@/lib/validations/whitelist";
import type { Role } from "@prisma/client";

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function createWhitelistEmail(data: {
  email: string;
  role: Role;
}) {
  await checkAdmin();

  const validated = whitelistEmailSchema.parse(data);

  try {
    const whitelist = await prisma.whitelistEmail.create({
      data: {
        email: validated.email.toLowerCase().trim(),
        role: validated.role,
      },
    });

    return { success: true, data: whitelist };
  } catch (error: any) {
    if (error.code === "P2002") {
      return { success: false, error: "Email already exists in whitelist" };
    }
    console.error("Error creating whitelist:", error);
    return {
      success: false,
      error: error.message || "Failed to create whitelist",
    };
  }
}

export async function updateWhitelistEmail(
  id: string,
  data: { email: string; role: Role }
) {
  await checkAdmin();

  const validated = whitelistEmailSchema.parse(data);

  try {
    const whitelist = await prisma.whitelistEmail.update({
      where: { id },
      data: {
        email: validated.email.toLowerCase().trim(),
        role: validated.role,
      },
    });

    return { success: true, data: whitelist };
  } catch (error: any) {
    console.error("Error updating whitelist:", error);
    return {
      success: false,
      error: error.message || "Failed to update whitelist",
    };
  }
}

export async function deleteWhitelistEmail(id: string) {
  await checkAdmin();

  try {
    await prisma.whitelistEmail.delete({
      where: { id },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error deleting whitelist:", error);
    return {
      success: false,
      error: error.message || "Failed to delete whitelist",
    };
  }
}

