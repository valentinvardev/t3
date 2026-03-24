"use server";

import bcrypt from "bcryptjs";
import { db } from "~/server/db";

type RegisterResult =
  | { success: true }
  | { success: false; error: string };

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<RegisterResult> {
  if (!email || !password || !name) {
    return { success: false, error: "All fields are required." };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "An account with this email already exists." };
  }

  const hashed = await bcrypt.hash(password, 12);

  await db.user.create({
    data: { email, name, password: hashed },
  });

  return { success: true };
}
