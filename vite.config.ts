import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  // Pages publishes under /FleetCare/; local development keeps the root URL.
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  test: { environment: "node", setupFiles: ["./tests/setup.ts"] },
});
