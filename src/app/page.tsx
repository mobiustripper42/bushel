import { VersionTag } from "@/components/VersionTag";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bay Branch Farm
        </h1>
        <p className="text-muted-foreground">
          Wholesale ordering — coming soon.
        </p>
      </div>
      <footer className="fixed bottom-2 right-3">
        <VersionTag className="text-xs text-muted-foreground" />
      </footer>
    </main>
  );
}
