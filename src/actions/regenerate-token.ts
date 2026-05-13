"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateToken } from "@/lib/tokens";

const TOKEN_UPDATE_RETRIES = 5;

export type RegenerateTokenResult = {
  error: string | null;
  token?: string;
};

export async function regenerateToken(id: string): Promise<RegenerateTokenResult> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < TOKEN_UPDATE_RETRIES; attempt++) {
    const token = generateToken();
    const { data, error } = await supabase
      .from("customers")
      .update({ token, updated_at: now })
      .eq("id", id)
      .select("token")
      .single();
    if (!error) {
      revalidatePath("/admin/customers");
      return { error: null, token: data.token };
    }
    if (error.code !== "23505") return { error: error.message };
  }
  return { error: "Could not generate a unique token. Try again." };
}
