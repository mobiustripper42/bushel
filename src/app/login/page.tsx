import { requestCode, verifyCode } from "./actions";
import { VersionTag } from "@/components/VersionTag";

const CODE_ERRORS: Record<string, string> = {
  invalid: "That code isn't right. Check it and try again.",
  expired: "That code has expired. Request a new one.",
  locked: "Too many attempts. Request a new code.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; next?: string; error?: string }>;
}) {
  const { step, next, error } = await searchParams;
  const onCodeStep = step === "code";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-xs flex-col items-center gap-6">
        <h1 className="text-2xl font-medium">Bay Branch Farm</h1>

        {onCodeStep ? (
          <form action={verifyCode} className="flex w-full flex-col gap-4">
            {next && <input type="hidden" name="next" value={next} />}
            <p className="text-center text-sm text-muted-foreground">
              If that email is registered, we sent a 6-digit code. Enter it below.
            </p>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              placeholder="123456"
              className="rounded-lg border border-foreground/20 px-4 py-3 text-center text-lg tracking-[0.4em]"
            />
            {error && CODE_ERRORS[error] && (
              <p className="text-center text-sm text-red-600">{CODE_ERRORS[error]}</p>
            )}
            <button
              type="submit"
              className="rounded-lg border border-foreground/20 px-6 py-3 text-base hover:bg-foreground/5"
            >
              Sign in
            </button>
            <a
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="text-center text-sm text-muted-foreground underline"
            >
              Use a different email
            </a>
          </form>
        ) : (
          <form action={requestCode} className="flex w-full flex-col gap-4">
            {next && <input type="hidden" name="next" value={next} />}
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="you@example.com"
              className="rounded-lg border border-foreground/20 px-4 py-3 text-base"
            />
            <button
              type="submit"
              className="rounded-lg border border-foreground/20 px-6 py-3 text-base hover:bg-foreground/5"
            >
              Email me a code
            </button>
          </form>
        )}
      </div>
      <footer className="fixed bottom-2 right-3">
        <VersionTag className="text-xs text-muted-foreground" />
      </footer>
    </main>
  );
}
