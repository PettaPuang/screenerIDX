import { z } from "zod";
import type { Role } from "@prisma/client";

export const whitelistEmailSchema = z.object({
  email: z.string().email("Invalid email format"),
  role: z.enum(["USER", "MODERATOR", "ADMIN"] as const),
});

export type WhitelistEmailInput = z.infer<typeof whitelistEmailSchema>;
