import { signInWithGoogle } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={signInWithGoogle} className="flex flex-col items-center gap-6">
        {next && <input type="hidden" name="next" value={next} />}
        <h1 className="text-2xl font-medium">Bay Branch Farm</h1>
        <button
          type="submit"
          className="rounded-lg border border-foreground/20 px-6 py-3 text-base hover:bg-foreground/5"
        >
          Sign in with Google
        </button>
      </form>
    </main>
  );
}
