// Small helpers for surfacing pg errors in Server Actions, which return
// { error: string } instead of throwing (the app's error contract).

export function pgMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function pgCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e
    ? String((e as { code: unknown }).code)
    : undefined;
}

// Postgres error codes the actions branch on.
export const UNIQUE_VIOLATION = "23505";
export const FOREIGN_KEY_VIOLATION = "23503";
