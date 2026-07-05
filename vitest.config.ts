import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// vitest is bushel's unit + DB-integration layer (DEC-051). Playwright stays
// E2E-only and owns `tests/*.spec.ts`; vitest owns `*.test.ts` under src/ (pure
// units) and db/tests/ (pg-integration against docker Postgres). The two never
// overlap — different file suffix, different dirs.
export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" → src/* so tests import the real app modules.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "db/tests/**/*.test.ts"],
    // Integration tests share one Postgres and truncate between tests, so files
    // must not run concurrently or their resets would race. Cheap — the suite
    // is small.
    fileParallelism: false,
  },
});
