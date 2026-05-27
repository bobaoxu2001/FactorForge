import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws when imported in a non-RSC bundle. Stub it out
      // in tests; the production path still gets the real guard via Next.
      "server-only": fileURLToPath(new URL("./vitest.server-only.stub.ts", import.meta.url)),
    },
  },
});
