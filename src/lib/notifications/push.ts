// Expo push-token registry writes (Phase 11.1). The bushel-mobile app registers
// its device token here after sign-in; the order-arrival fan-out (bushel-mobile
// Phase 1) reads the table to know where to push. Upsert on the token so a
// device re-registering — new session, reinstall, admin switch — updates the
// owning admin + platform in place rather than piling up duplicate rows.
import { query } from "@/lib/db";

export type Platform = "android" | "ios";

export async function registerPushToken(
  adminId: string,
  expoPushToken: string,
  platform: Platform,
): Promise<void> {
  await query(
    `insert into push_tokens (admin_id, expo_push_token, platform)
     values ($1, $2, $3)
     on conflict (expo_push_token) do update
       set admin_id = excluded.admin_id,
           platform = excluded.platform,
           updated_at = now()`,
    [adminId, expoPushToken, platform],
  );
}
