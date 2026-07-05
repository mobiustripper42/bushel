"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { pgCode, pgMessage, UNIQUE_VIOLATION } from "@/lib/pg-errors";
import { generateToken } from "@/lib/tokens";

const TOKEN_UPDATE_RETRIES = 5;

export type RegenerateTokenResult = {
  error: string | null;
  token?: string;
};

export async function regenerateToken(id: string): Promise<RegenerateTokenResult> {
  const user = await getAdminUser();
  if (!user) return { error: "Unauthorized" };

  for (let attempt = 0; attempt < TOKEN_UPDATE_RETRIES; attempt++) {
    const token = generateToken();
    try {
      const rows = await query<{ token: string }>(
        `update customers set token = $1, updated_at = now()
          where id = $2
          returning token`,
        [token, id],
      );
      if (rows.length === 0) return { error: "Customer not found." };
      revalidatePath("/admin/customers");
      return { error: null, token: rows[0].token };
    } catch (e) {
      if (pgCode(e) !== UNIQUE_VIOLATION) return { error: pgMessage(e) };
    }
  }
  return { error: "Could not generate a unique token. Try again." };
}
